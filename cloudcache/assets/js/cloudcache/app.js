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
        },

        /**
         * Convenience wrapper around jquery-confirm's confirm function. Only need to pass the title, content,
         * confirmButton text, and the confirm callback.
         **/
        confirm: function(title, content, confirmButton, onConfirm) {
            $.confirm({
                title: title,
                content: content,
                theme: 'black',
                animation: 'top',
                closeAnimation: 'bottom',
                columnClass: 'col-md-8 col-md-offset-6 col-sm-20',
                confirmButton: confirmButton,
                confirmButtonClass: 'btn-danger',
                cancelButton: 'Cancel',
                confirm: onConfirm,
            });
        }
    };

    // -----------------------------------------------------------------------------------------------------------------
    //                                   The cloudCache application controller object
    // -----------------------------------------------------------------------------------------------------------------
    var App = {

        tree: null,

        notes: [],
        checklists: [],

        noteTemplate: null,
        checklistTemplate: null,

        /**
         * Initialize the app controller, perform all the setup stuff necessary.
         **/
        init: function() {

            // Register the renderContents helper function with Handlebars.js and compile the templates.
            Handlebars.registerHelper('render', util.renderContents);
            this.noteTemplate = Handlebars.compile($('#note-template').html());
            this.checklistTemplate = Handlebars.compile($('#checklist-template').html());

            this.wireEvents();

            // Do an initial load of the notes and checklists
            $.when(this.async_loadChecklists(), this.async_loadNotes()).done(function(){
                this.buildNotes.bind(this)();
            }.bind(this));
        },

        /**
         * Handle the note modal delete button being clicked by doing the following:
         *      1) Pop up a confirmation dialog. If the user chooses yes...
         *      2) Make ajax note delete call, which when complete, hides the note edit modal
         **/
        handleNoteModalNoteDelete: function($note) {
            var onConfirm = function(){
                this.deleteNote($note, function(){ $('#editNote').modal('hide'); });
            };
            util.confirm('Delete note?', 'This action cannot be reversed.', 'Delete', onConfirm.bind(this));
        },

        /**
         * Handle the list modal delete button being clicked by doing the following:
         *      1) Pop up a confirmation dialog. If the user chooses yes...
         *      2) Make ajax list delete call, which when complete, hides the list edit modal
         **/
        handleListModalListDelete: function($list) {
            var onConfirm = function(){
                this.deleteList($list, function(){ $('#editList').modal('hide'); });
            };
            util.confirm('Delete checklist?', 'This action cannot be reversed.', 'Delete', onConfirm.bind(this));
        },

        /**
         * Handle the edit note modal being clicked out by doing the following:
         *      1) Get the whitespace-trimmed content of the note title
         *      2) Get the content of the note body, where <br> are replaced by \r\n
         *      3) Make an async PUT call to update the new note. Upon success, do the following:
         *          a) Update the note div's title with the new title
         *          b) Update the note div's content with the new content
         *          c) Hide the note modal
         **/
        handleEditNoteSave: function($note) {
            var editTitle = $('#editNoteTitle').text().trim();

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
                    'owner'    : $note.data('owner-url'),
                },
                success: function(data){
                    $note.children('.title').text(editTitle);
                    $note.children('.contents').html($('#editNoteContents').html());
                },
            });
        },

        /**
         * Handle the edit list modal being clicked out by doing the following:
         **/
        handleEditListSave: function($list) {

            var deferreds = Array();

            $('#editListContents')
                .find('.item:not([data-isnew])')
                .each(function(){
                    deferreds.push($.ajax({
                        url: $(this).data('url'),
                        type: 'PUT',
                        timeout: 1000,
                        data: {
                            'text'      : $(this).find('span').text(),
                            'checklist' : $list.data('url'),
                            'complete'  : $(this).find('input').prop('checked'),
                        },
                    }));
                });

            $('#editListContents')
                .find('.item[data-isnew]')
                .each(function(){
                    if($(this).find('span').text()) {
                        deferreds.push($.ajax({
                            url: '/api/checklistitems/',
                            type: 'POST',
                            timeout: 1000,
                            data: {
                                'text'      : $(this).find('span').text(),
                                'checklist' : $list.data('url'),
                                'complete'  : $(this).find('input').prop('checked'),
                            },
                        }));
                    }
                });

            var editTitle = $('#editListTitle').text().trim();

            var renderChecklist = this.checklistTemplate;
            var rebindChecklistCheckboxEvents = this.rebindChecklistCheckboxEvents.bind(this);

            $.when.apply($, deferreds).done(function(){
                $.ajax({
                    url: $list.data('url'),
                    type: 'PUT',
                    timeout: 1000,
                    data: {
                        'title'    : editTitle,
                        'owner'    : $list.data('owner-url'),
                    },
                    success: function(data){
                        var $newList = $(renderChecklist(data));
                        $list.replaceWith($newList);

                        // apply iCheck checkboxes to the checklist checkboxes
                        $('.checklist .item input').iCheck({
                            checkboxClass: 'icheckbox_minimal-grey',
                            radioClass: 'iradio_minimal-grey',
                        });

                        rebindChecklistCheckboxEvents();

                        $newList.showThenAnimateCss('zoomIn');
                    },
                });
            });
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

            $('#editNoteTitle')
                .text($note.children('.title').text())
                .trigger('change');

            $('#editNoteContents')
                .html($note.children('.contents').html())
                .trigger('change');

            $('#editNoteDelete').click(function(){
                this.handleNoteModalNoteDelete($note);
            }.bind(this));

            $('#editNote')
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNoteTitle'));
                })
                .on('hide.bs.modal', function(){
                    this.handleEditNoteSave($note);
                    $note.showThenAnimateCss('zoomIn');
                    $('#editNote, #editNoteTitle, #editNoteSave, #editNoteDelete').off();
                }.bind(this));

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
         * Handle the note trash can icon being clicked by doing the following:
         *      1) Display a confirmation box, asking the user if they are sure.
         *          a) If yes, call the function to delete the note
         *          b) If no, just close the confirm dialog and do nothing further.
         **/
        handleNoteTrashCanClick: function(e){
            var onConfirm = function() {
                this.deleteNote($(e.target).closest('.note'));
            };
            util.confirm('Delete note?', 'This action cannot be reversed.', 'Delete', onConfirm.bind(this));
        },

        /**
         * Handle the list trash can icon being clicked by doing the following:
         *      1) Display a confirmation box, asking the user if they are sure.
         *          a) If yes, call the function to delete the note
         *          b) If no, just close the confirm dialog and do nothing further.
         **/
        handleListTrashCanClick: function(e){
            var onConfirm = function() {
                this.deleteList($(e.target).closest('.checklist'));
            };
            util.confirm('Delete checklist?', 'This action cannot be reversed.', 'Delete', onConfirm.bind(this));
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
         * Perform an ajax call to delete the provided list (a jQuery object of a list div). When the async call is
         * done, do the following:
         *      1) Animate the list div with a zoom-out animation to make it visually disappear
         *      2) Remove the list div from the DOM
         *      3) If a callback function was supplied, call it
         **/
        deleteList: function($list, callback) {
            $.ajax({
                url: $list.data('url'),
                type: 'DELETE',
                timeout: 1000,
                success: function() {
                    $list.animateCss('zoomOut', function() {
                        $list.remove();
                        if (callback) callback();
                    });
                },
            });
        },

        /**
         * Handle the new note modal being clicked out by doing the following:
         *      1) Get the whitespace-trimmed content of the note title
         *      2) Get the content of the note body, where <br> are replaced by \r\n
         *      3) If either note title or content are empty, alert the user and return early
         *      4) Make an async POST call to create the new note. Upon success, do the following:
         *          a) Render the note with the note template
         *          b) Append it to the shortest column in the notes wrapper
         *          c) Animate the note and fade it in
         *          d) Hide the note modal
         **/
        handleNewNoteSave: function() {

            var editTitle = $('#editNoteTitle').text().trim();

            var editContent = '';
            $.each($('#editNoteContents').html().split('<br>'), function(i, line){
                editContent += '\r\n' + line;
            });
            editContent = editContent.trim();

            if (editTitle == '' || editContent == '') {
                return;
            }

            // Make POST call to create new note
            $.ajax({
                url: '/api/notes/',
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
                }.bind(this),
            });
        },

        /**
         * Handle the new note div being clicked by doing the following:
         *      1) Hide the note modal's delete button
         *      2) Clear out the note modal title, and trigger 'change' so the placeholder text is displayed
         *      3) Clear out the note modal content, and trigger 'change' so the placeholder text is displayed
         *      4) Attach a click handler to the note modal's save button, to save the note
         *      5) Attach misc event handlers to the note modal itself:
         *          a) After being shown, move the cursor to the end of the title div
         *          b) When being hidden, detach all event handlers on the modal itself, title, save, and delete buttons
         *      6) Attach a keypress handler on the modal title to capture 'enter', and move the cursor to the contents
         *      7) Show the modal
         **/
        handleNewNoteClick: function(e){

            $('#editNoteDelete').hide();

            $('#editNoteTitle').text('')
                .trigger('change');

            $('#editNoteContents').html('')
                .trigger('change');

            $('#editNote')
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editNoteTitle'));
                })
                .on('hidden.bs.modal', function() {
                    this.handleNewNoteSave.bind(this)();
                    $('#editNoteDelete, #editNoteSave, #editNoteTitle, #editNote').off();
                }.bind(this));

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
         *
         **/
        handleListClick: function(e) {
            var $list = $(e.target).closest('.checklist');

            $('#editListTitle')
                .text($list.children('.title').text())
                .trigger('change');

            $('#editListContents')
                .empty();

            $list.find('.item').each(function(){
                var $item = $('<div class="item" data-url="' + $(this).data('url') + '"><input type="checkbox"><span contenteditable="true"></span></div>');
                $item.find('span').text($(this).find('span').text());
                if($(this).find('span').hasClass('complete')){
                    $item.find('span').addClass('complete');
                }
                $item.find('input').prop('checked', $(this).find('input').prop('checked'));
                $('#editListContents').append($item);
            });

            $('#editListContents')
                .on('ifChecked', 'input', function(e){
                    $(this).parent().next().addClass('complete');
                })
                .on('ifUnchecked', 'input', function(e){
                    $(this).parent().next().removeClass('complete');
                });

            var $newItem = $('<div class="item" data-isnew="true"><input type="checkbox"><span contenteditable="true" data-placeholder="Item..."></span></div>');
            $('#editListContents').append($newItem);

            // apply iCheck checkboxes to the checklist checkboxes
            $('#editListContents .item input').iCheck({
                checkboxClass: 'icheckbox_minimal-grey',
                radioClass: 'iradio_minimal-grey',
            });

            $('#editListDelete').click(function(){
                this.handleListModalListDelete($list);
            }.bind(this));

            $('#editList')
                .on('keypress', '.item', function(e){
                    if (e.which == 13) {
                        var $newItem = $('<div class="item" data-isnew="true"><input type="checkbox"><span contenteditable="true" data-placeholder="Item..."></span></div>');
                        $(this).after($newItem);
                        // apply iCheck checkboxes to the checklist checkboxes
                        $('#editListContents .item input').iCheck({
                            checkboxClass: 'icheckbox_minimal-grey',
                            radioClass: 'iradio_minimal-grey',
                        });
                        e.preventDefault();

                        util.setEndOfContenteditable($('#editListContents > div > span:empty'));
                    }
                });

            $('#editList')
                .on('shown.bs.modal', function() {
                    util.setEndOfContenteditable($('#editListTitle'));
                })
                .on('hide.bs.modal', function(){
                    this.handleEditListSave.bind(this)($list);
                    $('#editList, #editListTitle, #editListDelete').off();
                }.bind(this));

            $list.animateCssThenHide('zoomOut');
            $('#editList').modal('show');
        },

        /**
         * Wire up events for pretty much everything
         **/
        wireEvents: function() {

            $('#notes-wrapper').on('click', '.note', this.handleNoteClick.bind(this));
            $('#notes-wrapper').on('click', '.checklist', this.handleListClick.bind(this));

            var boundHandleNoteTrashCanClick = this.handleNoteTrashCanClick.bind(this);
            $('#notes-wrapper').on('click', '.note .glyphicon-trash', function(e){
                boundHandleNoteTrashCanClick(e);
                e.stopPropagation();
            });

            var boundHandleListTrashCanClick = this.handleListTrashCanClick.bind(this);
            $('#notes-wrapper').on('click', '.checklist .glyphicon-trash', function(e){
                boundHandleListTrashCanClick(e);
                e.stopPropagation();
            });

            $('#new-note').on('click', this.handleNewNoteClick.bind(this));
        },

        /**
         * Perform an async ajax call to update a checklist item with the parameters sent in the function.
         **/
        updateChecklistItem: function(url, text, complete, checklistUrl, callback) {
            $.ajax({
                url: url,
                type: 'PUT',
                timeout: 1000,
                data: {
                    'text'      : text,
                    'complete'  : complete,
                    'checklist' : checklistUrl,
                },
                success: function(data){
                    if (callback) callback(data);
                },
            });
        },

        /**
         * Bind event handlers to the checklist div checkboxes to update the checklist items when checked or unchecked.
         **/
        rebindChecklistCheckboxEvents: function() {

            $('.checklist .item input').off().on('ifToggled', function(e) {

                var checked = $(e.target).is(':checked');
                var $list   = $(e.target).parents('.checklist');
                var $item   = $(e.target).parents('.item');

                if (checked)
                    $item.find('span').addClass('complete');
                else
                    $item.find('span').removeClass('complete');

                this.updateChecklistItem($item.data('url'), $item.find('span').text(), checked, $list.data('url'));

            }.bind(this));

        },

        /**
         * Iterate through the arrays of notes and checklists, running each through the appropriate template and then
         * appending it to the shortest column in the notes wrapper.
         **/
        buildNotes: function() {

            // render and append notes
            $.each(this.notes, function(i, note){
                $(this.noteTemplate(note))
                    .appendTo(util.getShortestColumn())
                    .animateCss('fadeIn');
            }.bind(this));

            // render and append checklists
            $.each(this.checklists, function(i, list){
                $(this.checklistTemplate(list))
                    .appendTo(util.getShortestColumn())
                    .animateCss('fadeIn');
            }.bind(this));

            // apply iCheck checkboxes to the checklist checkboxes
            $('.checklist .item input').iCheck({
                checkboxClass: 'icheckbox_minimal-grey',
                radioClass: 'iradio_minimal-grey',
            });

            this.rebindChecklistCheckboxEvents();
        },

        /**
         * Kick off the async process for retrieving all notes for the current notebook. Return an async promise to the
         * caller so they can do whatever they want whenever this is ready.
         **/
        async_loadNotes: function() {
            return $.ajax({
                url: '/api/notes/',
                type: 'GET',
                timeout: 1000,
            }).then(function(notes){
                this.notes = notes;
            }.bind(this));
        },

        /**
         * Kick off the async process for retrieving all checklists for the current notebook. Return an async promise
         * to the caller so they can do whatever they want whenever this is ready.
         **/
        async_loadChecklists: function() {
            return $.ajax({
                url: '/api/checklists/',
                type: 'GET',
                timeout: 1000,
            }).then(function(checklists){
                this.checklists = checklists;
            }.bind(this));
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

    // Update the section with the custom scroll bar whenever the window resizes
    $(window).resize(util.debounce(function(){
        $('#notes-wrapper').mCustomScrollbar("update");
    },50));

    App.init();
});