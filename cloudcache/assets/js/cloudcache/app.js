$(function(){
    // -----------------------------------------------------------------------------------------------------------------
    //    Utility functions which are more general-purpose, and don't logically belong to the app controller itself
    // -----------------------------------------------------------------------------------------------------------------
    var util = {

        /**
         * Handlebars.js helper function to render note body contents into the note template. Takes each line break in
         * note contents, replaces it with an HTML line break element, and puts the line itself with the <br> into a
         * <div>. When complete, returns the div's inner html.
         **/
        renderContents: function(contents) {
            var $tmp = $('<div>');
            $.each(contents.split('\r\n'), function(i, line){
                $tmp
                    .append(line)
                    .append($('<br>'));
            });
            return new Handlebars.SafeString($tmp.html());
        },

        /**
         * Cross-browser method to clear all text selections in the browser.
         **/
        clearTextSelection: function() {
            if (window.getSelection) {
              if (window.getSelection().empty) {  // Chrome
                window.getSelection().empty();
              } else if (window.getSelection().removeAllRanges) {  // Firefox
                window.getSelection().removeAllRanges();
              }
            } else if (document.selection) {  // IE?
              document.selection.empty();
            }
        },

        /**
         * Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be
         * called after it stops being called for N milliseconds. If `immediate` is passed, trigger the function on the
         * leading edge, instead of the trailing edge.
         **/
        debounce: function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        },

        /**
         * General utility function for turning a flat list of objects into a nested structure. The ID, parent, and
         * children attribute names are configurable, but it's assumed that each object coming in has a unique ID, and
         * that each object either identifies a parent object by ID or identifies an explicit null parent, meaning it's
         * a root element.
         **/
        _buildNested: function(list, idAttr, parentAttr, childrenAttr) {
            if (!idAttr)       idAttr       = 'url';
            if (!parentAttr)   parentAttr   = 'parent';
            if (!childrenAttr) childrenAttr = 'nodes';
            var treeList = [];
            var lookup = {};
            list.forEach(function(obj) {
                lookup[obj[idAttr]] = obj;
                obj[childrenAttr] = [];
            });
            list.forEach(function(obj) {
                if (obj[parentAttr] != null) {
                    lookup[obj[parentAttr]][childrenAttr].push(obj);
                } else {
                    treeList.push(obj);
                }
            });
            return treeList;
        },

        /**
         * Bootstrap-Treeview believes that all objects with a 'nodes' attribute have children, even if that attribute
         * is an empty array, and will display a collapse/expand icon. We don't want that behavior, so if a notebook has
         * no child notebooks, we'll delete the (empty) 'nodes' attribute. If there are child notebooks, recursively
         * check them for empty 'nodes' attributes as well.
         **/
        _deleteEmptyNodes: function(notebooks) {
            notebooks.forEach(function(notebook) {
                if (notebook.nodes.length == 0) {
                    delete notebook.nodes;
                } else {
                    notebook.nodes = util._deleteEmptyNodes(notebook.nodes);
                }
            });
            return notebooks;
        },

        /**
         * Bootstrap-Treeview library requires each object in the hierarchy to have a 'text' attribute for displaying
         * the node in the tree. We can just use the notebook's name, so we rename it to 'text'. Also, child objects in
         * the tree fall under a 'nodes' attribute. This information is in the notebook's 'notebooks' attribute, which
         * we can just rename to 'nodes'.
         **/
        _renameFieldsForTreeview: function(notebooks) {
            notebooks.forEach(function(notebook){
                notebook.text  = notebook.name;      delete notebook.name;
                notebook.nodes = notebook.notebooks; delete notebook.notebooks;
            });
            return notebooks;
        },

        /**
         * Ready the ajax-retrieved list of notebooks for use in the Bootstrap-Treeview tree by making it fit the format
         * that library is expecting.
        **/
        massageNotebookFormat: function(notebooks) {
            notebooks = util._renameFieldsForTreeview(notebooks);
            notebooks = util._buildNested(notebooks);
            notebooks = util._deleteEmptyNodes(notebooks);
            return notebooks;
        },

        /**
         * Helper function to determine the shortest child column/container (in terms of DOM height in pixels) in a
         * parent container. At the moment, just used to get the shortest notes column inside the notes wrapper.
         **/
        getShortestColumn: function(containerSelector, columnSelector) {
            containerSelector = containerSelector || '#notes-wrapper';
            columnSelector = columnSelector || '.note-col';
            var minHeight = 9999999;
            var shortColumn;
            $(containerSelector).find(columnSelector).each(function() {
                if ($(this).height() < minHeight) {
                    minHeight = $(this).height();
                    shortColumn = $(this);
                }
            });
            return shortColumn;
        },

        /**
         * Utility function to set the cursor at the end of the supplied contenteditable div.
         **/
        setEndOfContenteditable: function(jqueryObject) {
            var range,selection;
            var contentEditableElement = jqueryObject.get(0);
            //Firefox, Chrome, Opera, Safari, IE 9+
            if(document.createRange) {
                range = document.createRange();
                range.selectNodeContents(contentEditableElement);
                range.collapse(false);
                selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
            //IE 8 and lower
            else if(document.selection) {
                range = document.body.createTextRange();
                range.moveToElementText(contentEditableElement);
                range.collapse(false);
                range.select();
            }
        }
    };

    // -----------------------------------------------------------------------------------------------------------------
    //                                   The cloudCache application controller object
    // -----------------------------------------------------------------------------------------------------------------
    var App = {

        tree: null,

        currNotebook: null,

        notebooks: [],
        notes: [],

        noteTemplate: null,

        /**
         * Initialize the app controller, perform all the setup stuff necessary.
         **/
        init: function() {

            // Register the renderContents helper function with Handlebars.js and compile the template.
            Handlebars.registerHelper('render', util.renderContents);
            this.noteTemplate = Handlebars.compile($('#note-template').html());

            // Register with enquire.js so that if the the screen size changes and media queries are matched or
            // unmatched, the slideout menu size params are rebuilt and the toggle mechanism is reattached to the button
            this.buildMenu();
            enquire.register('only screen and (max-device-width: 480px)', {
                  match: this.buildMenu,
                unmatch: this.buildMenu,
            });

            this.wireEvents();

            // Do an initial load of the notebooks, and build the tree
            this.async_loadNotebooks().done(function(notebooks){
                this.notebooks = notebooks;
                this.buildTree();
                this.buildBreadcrumbs();
                $('#renameNotebook').hide();
                $('#deleteNotebook').hide();
                $('#default-view').show();
            });
        },

        /**
         * Build up the breadcrumbs for the current notebook structure. Start at the current notebook, then keep working
         * up the tree until the root is reached. At each notebook, append a link element with the notebook's name.
         * All root notebooks fall under an imaginary element here which we'll call 'Home'.
         **/
        buildBreadcrumbs: function() {

            var $breadcrumbs = $('.breadcrumbs').empty();

            // If no notebook is provided, bail out early
            if (this.currNotebook == null) return;

            var $rootLink = $('<a href="#">')
                .addClass('bc-root')
                .append('Home');

            $breadcrumbs.append(this.currNotebook.text);

            // Keep climbing the tree, finding each parent notebook, until we reach the top. For each parent notebook
            // append a link element with the parent's name
            var parent = this.tree.getParent(this.currNotebook);
            while (parent) {
                $breadcrumbs.append(' ▶ ');
                $("<a href='#'>")
                    .append(parent.text)
                    .addClass('bc-crumb')
                    .attr('data-nodeId', parent.nodeId)
                    .appendTo($breadcrumbs);
                parent = this.tree.getParent(parent);
            }

            $breadcrumbs.append(' ▶ ');
            $breadcrumbs.append($rootLink);
        },

        /**
         * Handle a click of a row (in effect, selecting a notebook) in the treeview by doing the following:
         *      1) Set the current notebook to the one selected in the treeview
         *      2) Ensure the new note div is visible, by showing the new note wrapper
         *      3) Remove any notes from the notes wrapper
         *      4) Perform an async notes load for the current notebook, which when complete, does the following:
         *          a) Creates note divs for each note then appends them to the notes wrapper
         *      5) Build the breadcrumbs for the current notebook hierarchy
         *      6) Ensure the rename notebook menu option is visible
         *      7) Ensure the delete notebook menu option is visible
         *      8) Ensure the default view is hidden
         **/
        handleTreeClick: function(e, notebookNode) {
            this.currNotebook = notebookNode;

            $('#new-note-wrapper').show();

            $('#notes-wrapper').find('.note-col').empty();
            this.async_loadNotes().done(function(notes){
                this.notes = notes;
                this.buildNotes();
            });

            this.buildBreadcrumbs();
            $('#renameNotebook').show();
            $('#deleteNotebook').show();
            $('#default-view').hide();
        },

        /**
         * Handle deselecting a row (in effect, no notebook being chosen) in the treeview by doing the following:
         *      1) Set the current notebook to null
         *      2) Ensure the new note div is invisible, by hiding the new note wrapper
         *      3) Remove any notes from the notes wrapper
         *      4) Clear breadcrumbs (by running buildBreadcrumbs with a null current notebook)
         *      5) Ensure the rename notebook menu option is hidden
         *      6) Ensure the delete notebook menu option is hidden
         *      7) Ensure the default view is visible
         **/
        handleTreeUnselect: function(e, notebookNode) {
            this.currNotebook = null;
            $('#new-note-wrapper').hide();

            $('#notes-wrapper').find('.note-col').empty();
            this.buildBreadcrumbs();

            $('#renameNotebook').hide();
            $('#deleteNotebook').hide();
            $('#default-view').show();
        },

        /**
         * Handle a note being clicked by doing the following:
         *      1) Make sure we have a ref to the actual note itself, in case an internal element click triggered this
         *      2) Set the note modal title to the title of the note being clicked, trigger change to erase placeholder
         *      3) Set the note modal content to that of the note being clicked, trigger change to erase placeholder
         *      4) Attach a click handler to the note modal's save button to perform saving the note
         *      5) Attach a click handler to the note modal's delete button to perform deleting the note
         *      6) Attach misc handlers to the note modal itself:
         *          a) After being shown, put the cursor at the end of the title div
         *          b) When hiding/closing the modal, do the following:
         *              i) Animate/zoom the note being edited back in
         *              ii) Disconnect all event handlers on the modal itself, save button, delete button, and title
         *      7) Attach a keypress handler on the note modal title to capture enter key and trigger a save btn click
         *      8) Hide/zoom out the note being edited
         *      9) Show the modal
         **/
        handleNoteClick: function(e) {

            var $note = $(e.target).closest('.note');

            $('#editNoteTitle').text($note.children('.title').text()).trigger('change');
            $('#editNoteContents').html($note.children('.contents').html()).trigger('change');

            $('#editNoteSave').click(function(e){

                var editTitle = $('#editNoteTitle').text();

                var editContent = '';
                $.each($('#editNoteContents').html().split('<br>'), function(i, line){
                    editContent += '\r\n' + line;
                });
                editContent = editContent.trim();

                $.ajax({
                    url: $note.data('url'),
                    type: 'PUT',
                    timeout: 1000,
                    data: {
                        'title'    : editTitle,
                        'content'  : editContent,
                        'notebook' : $note.data('notebook-url'),
                    },
                    success: function(data){
                        $note.children('.title').text(editTitle);
                        $note.children('.contents').html($('#editNoteContents').html());
                        $('#editNote').modal('hide');
                    },
                });
            });

            $('#editNoteDelete').click(function(e){
                $.confirm({
                    title: 'Delete?',
                    content: 'This action cannot be reversed.',
                    theme: 'black',
                    animation: 'top',
                    closeAnimation: 'bottom',
                    columnClass: 'col-md-8 col-md-offset-6 col-sm-20',
                    confirmButton: 'Delete',
                    confirmButtonClass: 'btn-danger',
                    cancelButton: 'Cancel',
                    confirm: function() {
                        this.deleteNote($note, function(){ $('#editNote').modal('hide'); });
                    }.bind(this),
                });
            }.bind(this));

            $('#editNote')
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNoteTitle'));
                })
                .on('hide.bs.modal', function(){
                    $note.showThenAnimateCss('zoomIn');
                    $('#editNote').off();
                    $('#editNoteTitle').off();
                    $('#editNoteSave').off();
                    $('#editNoteDelete').off();
                });

            $('#editNoteTitle')
                .on('keypress', function(e){
                    if (e.keyCode == 13) {
                        $('#editNoteSave').trigger('click');
                        return false;
                    }
                });

            $note.animateCssThenHide('zoomOut');
            $('#editNote').modal('show');
        },

        /**
         * Handle the root breadcrumb element being clicked by doing the following:
         *      1) Set the current notebook to null
         *      2) Hide the new note div by setting its wrapper to be hidden
         *      3) Unselect the current node in the treeview, suppressing events being fired by this
         *      4) Empty the notes wrapper of any notes which might be in there
         *      5) Empty the breadcrumbs, by running buildBreadcrumbs when the current notebook is null
         *      6) Hide the rename notebook menu option
         *      7) Hide the delete notebook menu option
         *      8) Show the default view in the main content panel
         **/
        handleRootBreadcrumbClick: function() {

            this.currNotebook = null;
            $('#new-note-wrapper').hide();

            this.tree.unselectNode(this.tree.getSelected()[0], {silent: true});

            $('#notes-wrapper').find('.note-col').empty();
            this.buildBreadcrumbs();

            $('#renameNotebook').hide();
            $('#deleteNotebook').hide();
            $('#default-view').show();
        },

        /**
         * Handle a non-root breadcrumb element being clicked by doing the following:
         *      1) Set the current notebook to the node in the tree with the node ID from the breadcrumb being clicked
         *      3) Select that notebook in the treeview, suppressing events being fired by this
         *      3) Show that notebook in the treeview, suppressing events being fired by this
         *      4) Empty the notes wrapper of any notes which might be in there
         *      5) Perform an async notes load for the current notebook, which when complete, does the following:
         *          a) Creates note divs for each note then appends them to the notes wrapper
         *      6) Build up the breadcrumbs for the current notebook hierarchy
         *      7) Show the rename notebook menu option
         *      8) Show the delete notebook menu option
         *      9) Hide the default view from the main content panel
         **/
        handleBreadcrumbClick: function(e) {

            var $notebook = $(e.target);
            this.currNotebook = this.tree.getNode($notebook.attr('data-nodeId'));

            this.tree.selectNode(this.currNotebook, {silent: true});
            this.tree.revealNode(this.currNotebook, {silent: true});

            $('#notes-wrapper').find('.note-col').empty();
            this.async_loadNotes().done(function(notes){
                this.notes = notes;
                this.buildNotes();
            });

            this.buildBreadcrumbs();

            $('#renameNotebook').show();
            $('#deleteNotebook').show();
            $('#default-view').hide();
        },

        /**
         * Handle the trash can icon being clicked by doing the following:
         *      1) Display a confirmation box, asking the user if they are sure.
         *          a) If yes, call the function to delete the note
         *          b) If no, just close the confirm dialog and do nothing further.
         **/
        handleTrashCanClick: function(e){
            $.confirm({
                title: 'Delete?',
                content: 'This action cannot be reversed.',
                theme: 'black',
                animation: 'top',
                closeAnimation: 'bottom',
                columnClass: 'col-md-8 col-md-offset-6 col-sm-20',
                confirmButton: 'Delete',
                confirmButtonClass: 'btn-danger',
                cancelButton: 'Cancel',
                confirm: function() {
                    var $note = $(e.target).closest('.note');
                    this.deleteNote($note);
                }.bind(this),
            });
        },

        /**
         * Perform an ajax call to delete the provided note (a jQuery object of a note div). When the async call is
         * done, do the following:
         *      1) Animate the note div with a zoom-out animation to make it visually disappear
         *      2) Remove the note div from the DOM
         *      3) If a callback function was supplied, call it
         **/
        deleteNote: function($note, callback) {
            $.ajax({
                url: $note.data('url'),
                type: 'DELETE',
                timeout: 1000,
                success: function() {
                    $note.animateCss('zoomOut', function() {
                        $note.remove();
                        if (callback) callback();
                    });
                },
            });
        },

        /**
         * Handle the new note div being clicked by doing the following:
         *      1) Clear out the note modal title, and trigger 'change' so the placeholder text is displayed
         *      2) Clear out the note modal content, and trigger 'change' so the placeholder text is displayed
         *      3) Hide the note modal's delete button
         *      4) Attach a click handler to the note modal's save button, to save the note
         *      5) Attach misc event handlers to the note modal itself:
         *          a) After being show, move the cursor to the end of the title div
         *          b) When being hidden, detach all event handlers on the modal itself, title, save, and delete buttons
         *      6) Attach a keypress handler on the modal title to capture 'enter', and move the cursor to the contents
         *      7) Show the modal
         **/
        handleNewNoteClick: function(e){

            $('#editNoteTitle').text('')
                .trigger('change');

            $('#editNoteContents').html('')
                .trigger('change');

            $('#editNoteDelete').hide();

            $('#editNoteSave').click(function(e){

                var editTitle = $('#editNoteTitle').text().trim();

                var editContent = '';
                $.each($('#editNoteContents').html().split('<br>'), function(i, line){
                    editContent += '\r\n' + line;
                });
                editContent = editContent.trim();

                if (editTitle == '' || editContent == '') {
                    $.alert("Can't save the note. Please enter both a title and some note contents.", 'Oops');
                    return;
                }

                // Make POST call to create new note
                $.ajax({
                    url: this.currNotebook.url + 'notes/',
                    type: 'POST',
                    timeout: 1000,
                    contentType: 'application/json',
                    data: JSON.stringify({
                        'title'  : editTitle,
                        'content': editContent,
                    }),
                    success: function(note){
                        $(this.noteTemplate(note))
                            .appendTo(util.getShortestColumn())
                            .animateCss('fadeIn');
                        $('#editNote').modal('hide');
                    }.bind(this),
                });

            }.bind(this));

            $('#editNote')
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNoteTitle'));
                })
                .on('hidden.bs.modal', function() {
                    $('#editNote').off();
                    $('#editNoteTitle').off();
                    $('#editNoteSave').off();
                    $('#editNoteDelete').show();
                });

            $('#editNoteTitle')
                .on('keypress', function(e){
                    if (e.keyCode == 13) {
                        util.setEndOfContenteditable($('#editNoteContents'));
                        return false;
                    }
                });

            $('#editNote').modal('show');
        },

        /**
         * Handle the `Add Notebook` menu option being clicked by doing the following:
         *      1) Clear the notebook modal title, and trigger `change` so the placeholder text is entered
         *      2) Attach misc event handlers to the notebook modal:
         *          a) After being shown, move the cursor to the end of the modal's notebook name area
         *          b) On being hidden, detach all event handlers from the modal itself, and the save button
         *          b) On keypress, capture enter, and trigger a save button click instead
         *      3) Attach a click handler to the save button, to save the new notebook
         *      4) Show the modal
         **/
        handleAddNotebookClick: function(){

            $('#editNotebookName').text('')
                .trigger('change');

            $('#editNotebook')
                .on('hidden.bs.modal', function() {
                    $('#editNotebook').off();
                    $('#editNotebookSave').off();
                })
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNotebookName'));
                })
                .on('keypress', function(e){
                    if (e.keyCode == 13) {
                        $('#editNotebookSave').trigger('click');
                        return false;
                    }
                });

            $('#editNotebookSave').click(function(e){

                var newName = $('#editNotebookName').text().trim();
                var currNotebookUrl = this.currNotebook.url;

                // Make POST call to create new notebook
                $.ajax({
                    url: '/api/notebooks/',
                    type: 'POST',
                    timeout: 1000,
                    contentType: 'application/json',
                    data: JSON.stringify({
                        'name'  : newName,
                        'parent': currNotebookUrl,
                    }),
                    success: function(data){
                        this.currNotebook = this.tree.getSelected()[0];
                        this.async_loadNotebooks().done(function(notebooks){
                            this.notebooks = notebooks;
                            this.buildTree();
                            if (this.currNotebook) {
                                this.tree.selectNode(this.currNotebook.nodeId, {silent: true});
                                this.tree.revealNode(this.currNotebook.nodeId, {silent: true});
                            }
                            $('#editNotebook').modal('hide');
                        }.bind(this));
                    }.bind(this),
                    error: function(xhr, status, err) {
                        //notifyError("Error creating '<strong>" + nbName + "</strong>': " + status + ".");
                    }
                });

            }.bind(this));

            $('#editNotebook').modal('show');
        },

        /**
         * Handle the `Rename Notebook` menu option being clicked by doing the following:
         *      1) Set notebook modal title to the current title, and trigger `change` so the placeholder is removed
         *      2) Attach misc event handlers to the notebook modal:
         *          a) After being shown, move the cursor to the end of the modal's notebook name area
         *          b) On being hidden, detach all event handlers from the modal itself, and the save button
         *          b) On keypress, capture enter, and trigger a save button click instead
         *      3) Attach a click handler to the save button, to save the new notebook
         *      4) Show the modal
         **/
        handleRenameNotebookClick: function() {

            $('#editNotebookName').text(this.currNotebook.text)
                .trigger('change');

            $('#editNotebookSave').click(function(){
                // Make PUT call to update notebook
                $.ajax({
                    url: this.currNotebook.url,
                    type: 'PUT',
                    timeout: 1000,
                    data: {
                        'name'  : $('#editNotebookName').text().trim(),
                        'parent': this.currNotebook.parent,
                        'owner' : this.currNotebook.owner,
                    },
                    success: function(data){
                        this.async_loadNotebooks().done(function(notebooks){
                            this.notebooks = notebooks;
                            this.buildTree();
                            this.tree.selectNode(this.currNotebook.nodeId, {silent: true});
                            this.tree.revealNode(this.currNotebook.nodeId, {silent: true});
                            this.currNotebook = this.tree.getSelected()[0];
                            this.buildBreadcrumbs();
                            $('#editNotebook').modal('hide');
                        }.bind(this));
                    }.bind(this),
                    error: function(xhr, status, err) {
                        //notifyError("Error updating '<strong>" + nbName + "</strong>': " + status + ".");
                    }
                });
            }.bind(this));

            $('#editNotebook')
                .on('hidden.bs.modal', function() {
                    $('#editNotebook').off();
                    $('#editNotebookSave').off();
                })
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNotebookName'));
                })
                .on('keypress', function(e){
                    if (e.keyCode == 13) {
                        $('#editNotebookSave').trigger('click');
                        return false;
                    }
                });

            $('#editNotebook').modal('show');
        },

        /**
         * Handle the delete notebook menu option being clicked by doing the following:
         *      1) Display a confirmation box, indicating the dangers to the user
         *      2) If no, just exit without doing anything. If yes, continue
         *      3) Start an async ajax call to the delete the notebook.
         *          a) On success, do the following:
         *              i) Async reload notebooks
         *              ii) Rebuild the treeview
         *              iii) Set the current notebook to null
         *              iv) Clear breadcrumbs
         *              v) Empty the content panel of all notes
         *              vi) Hide the new note thingy
         *              vii) Show the default view
         **/
        handleDeleteNotebookClick: function(e){
            $.confirm({
                title: 'Delete notebook?',
                content: 'This action cannot be reversed. All nested notebook and notes will be deleted.',
                theme: 'black',
                animation: 'top',
                closeAnimation: 'bottom',
                columnClass: 'col-md-8 col-md-offset-6 col-sm-20',
                confirmButton: 'Delete',
                confirmButtonClass: 'btn-danger',
                cancelButton: 'Cancel',
                confirm: function() {
                    $.ajax({
                        url: this.currNotebook.url,
                        type: 'DELETE',
                        timeout: 1000,
                        success: function() {
                            this.async_loadNotebooks().done(function(notebooks){
                                this.notebooks = notebooks;
                                this.buildTree();
                                this.currNotebook = null;
                                this.buildBreadcrumbs();
                                $('#notes-wrapper').find('.note-col').empty();
                                $('#new-note-wrapper').hide();
                                $('#default-view').show();
                            }.bind(this));
                        }.bind(this),
                    });
                }.bind(this),
            });
        },

        /**
         * Wire up events for pretty much everything
         **/
        wireEvents: function() {

            $('#notes-wrapper').on('click', '.note', this.handleNoteClick.bind(this));

            var boundHandleTrashCanClick = this.handleTrashCanClick.bind(this);
            $('#notes-wrapper').on('click', '.glyphicon-trash', function(e){
                boundHandleTrashCanClick(e);
                e.stopPropagation();
            });

            $('#new-note-wrapper').on('click', '.new-note', this.handleNewNoteClick.bind(this));

            $('.breadcrumbs').on('click', '.bc-root', this.handleRootBreadcrumbClick.bind(this));
            $('.breadcrumbs').on('click', '.bc-crumb', this.handleBreadcrumbClick.bind(this));

            $('#addNotebook').click(this.handleAddNotebookClick.bind(this));
            $('#renameNotebook').click(this.handleRenameNotebookClick.bind(this));
            $('#deleteNotebook').click(this.handleDeleteNotebookClick.bind(this));
        },

        /**
         * Iterate through the current array of notes, running each through the template and then appending it to the
         * shortest column in the notes wrapper.
         **/
        buildNotes: function() {
            var buildNote = function(i, note){
                $(this.noteTemplate(note))
                    .appendTo(util.getShortestColumn())
                    .animateCss('fadeIn');
            };
            $.each(this.notes, buildNote.bind(this));
        },

        /**
         * Kick off the async process for retrieving all notebooks for the current user. When the call returns, run the
         * notebooks through the process to prepare them for use in the treeview, then return an async promise to the
         * caller so they can do whatever they want whenever this is ready.
         **/
        async_loadNotebooks: function () {
            return $.ajax({
                context: this,
                url: '/api/notebooks/',
                type: 'GET',
                timeout: 5000,
            }).then(util.massageNotebookFormat);
        },

        /**
         * Kick off the async process for retrieving all notebooks for the current notebook. Return an async promise
         * to the caller so they can do whatever they want whenever this is ready.
         **/
        async_loadNotes: function() {
            return $.ajax({
                context: this,
                url: this.currNotebook.url + 'notes/',
                type: 'GET',
                timeout: 1000,
            });
        },

        /**
         * Build the treeview in the sidebar. Bind the event handlers for tree nodes being selected and unselected.
         **/
        buildTree: function() {
            if (this.notebooks.length == 0) return;

            $('#tree').treeview({
                data: this.notebooks,
                levels: 2,
                showBorder: false,
                expandIcon: 'glyphicon glyphicon-triangle-right',
                collapseIcon: 'glyphicon glyphicon-triangle-bottom',
            });

            $('#tree')
                .on('nodeSelected', this.handleTreeClick.bind(this))
                .on('nodeUnselected', this.handleTreeUnselect.bind(this));

            this.tree = $('#tree').treeview(true);
        },

        /**
         * Build the slide-out menu, and attach a click handler to the hamburger icon. Make the menu visible when it's
         * done being built.
         **/
        buildMenu: function() {
            var slideout = new Slideout({
                'panel': $('#panel')[0],
                'menu': $('#menu')[0],
                'padding': $('.slide-menu').css('width'),
                'tolerance': 70
            });
            $('.hamburger')
                .off('click')
                .on('click', function() {
                    $(this).toggleClass('active');
                    slideout.toggle();
                });
            $('#menu').show();
        },
    };

// ---------------------------------------------------------------------------------------------------------------------
//
//              Everything beneath this point is code executed on load, mostly consisting of setup stuff.
//
// ---------------------------------------------------------------------------------------------------------------------

    // Utility function to get a cookie by name
    var getCookie = function(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // These HTTP methods do not require CSRF protection
    var csrfSafeMethod = function(method) {
        return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
    }

    // Set all ajax calls to send the CSRF token. Do *not* send the CSRF token if the request is cross-domain
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
            }
        }
    });

    // Animate.css-related extensions to jQuery, to facilitate applying an animation to an element
    $.fn.extend({
        animateCss: function (animationName, finishCallback) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            $(this).addClass('animated ' + animationName).one(animationEnd, function() {
                $(this).removeClass('animated ' + animationName);
                if (finishCallback) finishCallback();
            });
        },
        animateCssThenHide: function (animationName) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            $(this).addClass('animated ' + animationName).one(animationEnd, function() {
                $(this).css('visibility', 'hidden');
                $(this).removeClass('animated ' + animationName);
            });
        },
        showThenAnimateCss: function (animationName) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            $(this).css('visibility', 'visible');
            $(this).addClass('animated ' + animationName).one(animationEnd, function() {
                $(this).css('visibility', 'visible');
                $(this).removeClass('animated ' + animationName);
            });
        }
    });

    // Utility code intended to help with uniform contenteditable div behavior across browser platforms. Ensure that
    // line breaks inside contenteditable content are handle with <br> rather than paragraphs, nested divs, or anything
    // else like that.
    $("div[contenteditable]")
        // make sure br is always the lastChild of contenteditable
        .on("keyup mouseup", function(){
          if (!this.lastChild || this.lastChild.nodeName.toLowerCase() != "br") {
            this.appendChild(document.createElement("br"));
          }
        })
        // use br instead of div div
        .on("keypress", function(e){
          if (e.which == 13) {
            if (window.getSelection) {
              var selection = window.getSelection();
              var range = selection.getRangeAt(0);
              var br = document.createElement("br");
              range.deleteContents();
              range.insertNode(br);
              range.setStartAfter(br);
              range.setEndAfter(br);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              return false;
            }
          }
        });

    // Utility code to help emulate form input placeholders, in contenteditable divs.
    $(document).on('change keydown keypress input', '*[data-placeholder]', function() {
        if (this.textContent) {
            this.setAttribute('data-div-placeholder-content', 'true');
        }
        else {
            this.removeAttribute('data-div-placeholder-content');
        }
    });

    // Since none of the Glyphicons are present in the page at page-load, Bootstrap doesn't need to load the Glyphicons
    // web font until we retrieve notebooks via API, then build the notebooks DOM elements. Unfortunately, this causes
    // the icon to not display until it loads for the first time a fraction of a second later, causing a flicker.
    //
    // Here, we "preload" the Glyphicons before getting user notebooks by inserting, hiding, and immediately removing a
    // DOM element which contains a Glypicon. For this to be effective, it needs to be called before creating notebook
    // elements on the page for the first time
    $('<div>')
        .attr('style', 'height:0px; width:0px;')
        .addClass('glyphicon glyphicon-folder-open')
        .appendTo($('#panel'))
        .hide()
        .remove();

    // Wrap the notes wrapper section with a custom scrollbar.
    $('#notes-wrapper').mCustomScrollbar({
        theme: "dark",
        scrollInertia: 500,
    });

    App.init();
});