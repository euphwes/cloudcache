
// -- HACK ALERT --
// See lengthy comment at the end of attachNewNoteHandler()
var stillInNewNote = true;

/**
 * Bootstrap-Treeview believes that all objects with a 'nodes' attribute have children, even if that attribute is an
 * empty array, and will display a collapse/expand icon. We don't want that behavior, so if a notebook has no child
 * notebooks, we'll delete the (empty) 'nodes' attribute. If there are child notebooks, recursively check them for empty
 * 'nodes' attributes as well.
 **/
function deleteEmptyNodes(notebooks) {
    notebooks.forEach(function(notebook) {
        if (notebook.nodes.length == 0) {
            delete notebook.nodes;
        } else {
            notebook.nodes = deleteEmptyNodes(notebook.nodes);
        }
    });
    return notebooks;
}

/**
 * The Bootstrap-Treeview library requires each object in the hierarchy to have a 'text' attribute for displaying the
 * node in the tree. We can just use the notebook's name, so we rename it to 'text'. Also, child objects in the tree
 * fall under a 'nodes' attribute. This information is in the notebook's 'notebooks' attribute, which we can just rename
 * to 'nodes'.
 **/
function renameFieldsForTree(notebooks) {
    notebooks.forEach(function(notebook){
        notebook.text = notebook.name;
        delete notebook.name;
        notebook.nodes = notebook.notebooks;
        delete notebook.notebooks;
    });
    return notebooks;
}

// We want to get the shortest column in the content pane, to append the current note to the end of that.
// Check the height of each of the note-col divs inside the #notes-wrapper, find the shortest, and return that
function getShortestColumn(selector) {
    var minHeight = 9999999;
    var shortColumn;
    $(selector).children().each(function() {
        if ($(this).height() < minHeight) {
            minHeight = $(this).height();
            shortColumn = $(this);
        }
    });
    return shortColumn;
}

// Utility function for using the Bootstrap-notify plugin for notifications. Further wrapped by utility functions
// 'notifySuccess' and 'notifyError' below.
function notify(message, icon, type, delay) {
    $.notify({
        message: message,
        icon: 'glyphicon glyphicon-' + icon,
    },{
        type: type,
        placement: {
            from: 'bottom',
            align: 'right',
        },
        delay: delay,
    });
}
function notifySuccess(message) { notify(message, 'ok',               'info',   750);  }
function notifyError(message)   { notify(message, 'exclamation-sign', 'danger', 2500); }

/**
 * Attach a debounced on-edit event handler to this note div. When editing completes, hit the API endpoint for this
 * note to update the title and content.
 **/
function attachOnEditHandler(noteDiv) {

    var noteTitle = noteDiv.children('.title').children('.inline');
    noteTitle.on('keydown', function(e) { if (e.keyCode == 13) e.preventDefault(); });

    var editHandler = function() {

        var $note = $(this);

        var content = '';
        $note.children('.contents').children('p').each(function(index, element){
            content += '\r\n' + $(element).text();
        });

        // Make PUT call to submit updates to this note
        $.ajax({
            url: $note.attr('note-url'),
            type: 'PUT',
            timeout: 1000,
            data: {
                'title'    : $note.children('.title').text(),
                'notebook' : $note.attr('notebook-url'),
                'content'  : content,
            },
            success: function(data){ notifySuccess("Successfully updated '<strong>" + data.title + "</strong>'."); },
            error: function(xhr, stat, err) { notifyError("Error updating note: " + stat + "."); }
        });
    };

    noteDiv.on('input', debounce(editHandler, 1500));
}

/**
 * Attach an on-edit event handler to this note div. When editing completes, hit the current notebook's note list API
 * endpoint to save a new note.
 **/
function attachNewNoteHandler(noteDiv) {

    // Wire up a few event handlers to simulate the placeholder-text effect on a contenteditable div for the note title.
    // If the text in the div is the title placeholder text, focusing the div will clear the text. If the text is empty
    // when the div loses focus, it'll add back the placeholder text
    var noteTitle = noteDiv.children('.title').children('.inline');
    var titlePlaceholder = 'Take a note...';

    // Hack around a Chrome weirdness: if you focus a contenteditable element and immediately clear its text or html,
    // it loses the focus. You have to click again to make the cursor come back. The workaround is to put the clear
    // logic on a time delay, to fire slightly after the element gains focus.
    var titleClick = function(e) {
        stillInNewNote = true;
        var innerHandler = function() {
            if ($(e.target).text() == titlePlaceholder) $(e.target).text('');
        };
        setTimeout(innerHandler, 10);
    };

    noteTitle.on('click',    titleClick )
             .on('focus',    function() { $(this).click(); })
             .on('focusout', function() { if (!$(this).text()) $(this).text(titlePlaceholder); })
             .on('keydown', function(e) { if (e.keyCode == 13) e.preventDefault(); });

    // Wire up a few event handlers to simulate the placeholder-text effect on a contenteditable div for the note content.
    // If the text in the div is the title placeholder text, focusing the div will clear the text. If the text is empty
    // when the div loses focus, it'll add back the placeholder text
    var noteContent = noteDiv.children('.contents');
    var contentPlaceholder = 'Content goes here';

    // Same weird hack as above.
    var contentClick = function(e) {
        stillInNewNote = true;
        var innerHandler = function() {
            if ($(e.target).children('p').text() == contentPlaceholder) $(e.target).children('p').text('');
        };
        setTimeout(innerHandler, 10);
    };

    noteContent.on('click',    contentClick )
               .on('focus',    function() { $(this).click(); })
               .on('focusout', function() {
                    if (!$(this).children('p').text())
                        $(this).children('p').text(contentPlaceholder);
               });

    var editHandler = function() {

        // this editHandler was fired, but focus is still in the new note placeholder. Don't save yet
        if (stillInNewNote)
            return;

        var $note = $('.note.placeholder');

        var content = '';
        $note.children('.contents').children('p').each(function(index, element){
            var txt = $(element).text();
            if (txt) {
                content += '\r\n' + txt;
            }
        });

        var title = $note.children('.title').text();

        // If either the title or content of the note is empty, or still has the placeholder value, assume it's still
        // a work-in-progress and don't save yet
        if (!title || title == titlePlaceholder || !content || content == contentPlaceholder)
            return;

        // Make POST call to create new note
        $.ajax({
            url: $note.attr('notebook-url') + 'notes/',
            type: 'POST',
            timeout: 1000,
            contentType: 'application/json',
            data: JSON.stringify({
                'title'  : title,
                'content': content,
            }),
            success: function(data){
                // Build a new note, flagging it as created just now so it animates properly, and then rebuild the
                // new note placeholder
                buildNote(data, null, true);
                buildPlaceholderNote();
            },
            error: function(xhr, status, err) {
                notifyError("Error creating '<strong>" + title + "</strong>': " + status + ".");
            }
        });
    };

    // -- HACK ALERT --
    //
    // Only want to fire the editHandler when the focus leaves the note div entirely, but focusout will fire when
    // either title or contents loses focus. To deal with this, we maintain a global var 'stillInNewNote'.
    // This var is set to false immediately whenever note sees a focusout event, but if the title or contents
    // receives focus, we immediately set it back to true. We delay editHandler here by 1/8 second, to make sure the
    // title and content focus-in handlers have time to set stillInNewNote back to true. If the editHandler sees that
    // this variable is false, we'll know that something else other than the placeholder note div has focus, and we can
    // actually save the note
    noteDiv.on('focusout', function(e) {
        stillInNewNote = false;
        setTimeout(function(){ editHandler(); }, 125);
    });
}

// Build up a special note entity which is used to create new notes
function buildPlaceholderNote() {
    $('.note.placeholder').remove();
    var note = {
        title: 'Take a note...',
        content: 'Content goes here',
        notebook: $('#tree').treeview('getSelected')[0].url,
    }
    buildNote(note, true);
}

// Build up a note div which contains inner title and contents class divs, with the title and content of a note object
// retrieved from the API. Do a replace-all on note.content to turn newlines into HTML line breaks
function buildNote(note, placeholder, addedNow) {

    addedNow = addedNow || false;
    placeholder = placeholder || false;

    // --- Note header stuff ---
    var header = $('<div>')
        .addClass('title');

    $('<div>')
        .addClass('inline edit')
        .attr('contenteditable', true)
        .append(note.title)
        .appendTo(header);

    // --- Note content stuff ---
    var content = $('<div>')
        .addClass('contents')
        .attr('contenteditable', true);

    // In the note content, split on each line, then stick that line in a paragraph and append to the content div
    $.each(note.content.split('\r\n'), function(i, line){
        $('<p>')
            .append(line)
            .appendTo(content);
    });

    // -- Full note body --
    var note = $('<div>')
        .addClass('cc-element note')
        .attr({'note-url': note.url, 'notebook-url': note.notebook})
        .append(header, content);

    if (placeholder) {
        attachNewNoteHandler(note);
        note.addClass('placeholder')
            .prependTo($('#notes-wrapper').children()[0]);
    } else {
        attachOnEditHandler(note);
        note.appendTo(getShortestColumn('#notes-wrapper'));

        // flipInX, fadeInUp, bounceInUp
        if (addedNow) {
            note.animateCss('fadeInUp');
        } else {
            note.animateCss('fadeIn');
        }
    }
}

/**
 * Builds up a notebook div which contains the notebook
 **/
function buildNotebook(notebook) {

    var parent = notebook.parent || null;

    // If there is a currently selected notebook, get its url, otherwise set the current notebook url to null.
    var currTreeNodeId = null;
    if (parent !== null) {
        try {
            currTreeNodeId = $('#tree').treeview('getSelected')[0].nodeId;
        } catch(err) {}
    }

    var notebookDiv = $('<div>')
        .attr({'url': notebook.url, 'nodeid': notebook.nodeId})
        .addClass('cc-element notebook')
        .appendTo(getShortestColumn('#notebooks-wrapper'));

    $('<div>')
        .addClass('inline edit')
        .attr('contenteditable', true)
        .append(notebook.text)
        .appendTo(notebookDiv);

    $('<span>')
        .addClass('glyphicon glyphicon-folder-open pull-left hvr-pop-25')
        .appendTo(notebookDiv);

    // Wire up a few event handlers to simulate a placeholder in a contenteditable div for the notebook name.
    // If the text in the div is the notebook placeholder text, focusing the div will clear the text. If the text is
    // empty when the div loses focus, it'll add back the placeholder text
    var notebookName = notebookDiv.children('div.inline');

    var originalName = notebookName.text();

    // Event handler for when the thing loses focus
    var nameFocusOut = function() {

        var nbName = $(this).text().trim();

        // If the name is still the placeholder text, exit without saving
        if (nbName == originalName)
            return;

        // If the name is empty, restore the original name, and exit without saving
        if (!nbName) {
            $(this).text(originalName);
            return;
        }

        // Make PUT call to update notebook
        $.ajax({
            url: notebookDiv.attr('url'),
            type: 'PUT',
            timeout: 1000,
            data: {
                'name'  : nbName,
                'parent': parent,
                'owner' : notebook.owner,
            },
            success: function(){
                notifySuccess("Successfully updated <strong>'" + nbName + ".");
                getUserNotebooks(function(){
                    if (currTreeNodeId !== null)
                        $('#tree').treeview('selectNode', currTreeNodeId);
                });
            },
            error: function(xhr, status, err) {
                notifyError("Error updating '<strong>" + nbName + "</strong>': " + status + ".");
            }
        });
    };

    var catchKeys = function(e) {
        if (e.keyCode == 13) {
            $(this).trigger('focusout');
            e.preventDefault();
        }
    };

    // wire up the event handlers
    notebookName.on('focusout', nameFocusOut)
                .on('keydown',  catchKeys);
}

/**
 * Build up the breadcrumbs for the current notebook structure. Start at the current notebook, then keep working up the
 * tree until you reach the root. At each notebook, prepend an ol->li element with the notebook's name. All notebooks
 * fall under a root element here which we'll call 'Notebooks'.
 **/
function buildBreadcrumbs(notebook) {

    $('#breadcrumbs').empty();

    // If no notebook is provided, only put the 'Notebooks' crumb at the root, set it as active, and bail out early
    if (notebook == null) {
        $('<li>')
            .addClass('active')
            .append('Notebooks')
            .prependTo('#breadcrumbs');
        return;
    }

    // Make the last element the active element with the current notebook's name
    $('<li>')
        .addClass('active')
        .append(notebook.text)
        .prependTo('#breadcrumbs');

    // Keep climbing the tree, finding each parent notebook, until we reach the top. For each parent notebook, prepend
    // an ol->li element with that notebook's name
    var parent = $('#tree').treeview('getParent', notebook);
    while (parent.selector != '#tree') {
        var anchor = $('<a href="#">')
            .attr('id', 'crumb' + parent.nodeId)
            .append(parent.text);
        $('<li>')
            .append(anchor)
            .prependTo('#breadcrumbs');
        parent = $('#tree').treeview('getParent', parent);
    }

    // Wire up click handlers for each anchor
    $('#breadcrumbs li a').each(function(index, element){
        var nodeId = $(this).attr('id').replace('crumb','');
        $(this).click(function() {
            $('#tree').treeview('selectNode', parseInt(nodeId));
        });
    });

    // Prepend the root element in the breadcrumbs, which we'll call "Notebooks"
    var anchor = $('<a href="#">').append('Notebooks');
    var crumb = $('<li>').append(anchor);
    anchor.click(function() {
        $('#tree').treeview('unselectNode', $('#tree').treeview('getSelected')[0]);
    });
    $('#breadcrumbs').prepend(crumb);
}

/**
 * Builds a "go up" div which links to the current notebook's parent notebook
 **/
function buildUpOneLevelThing(notebook) {

    var returnToRoot = false;

    // Get the parent node in the treeview. If one doesn't exist, set a flag indicating this element will instead
    // return the user to the notebooks root
    var parent = $('#tree').treeview('getParent', notebook.nodeId);
    if (parent.selector == '#tree') returnToRoot = true;

    // Build a div which links to this notebook's parent. Put it in a nested row/column structure so that it is smaller
    // than the other notebook divs, to visually distinguish it a bit.
    var upIcon = $('<span>').addClass('glyphicon glyphicon-level-up');

    var back = $('<div>')
        .addClass('cc-element notebook go-up hvr-pop-5')
        .attr({'url': parent.url, 'nodeid': parent.nodeId})
        .append(upIcon);

    // If this div is returning the user to the root, add a 'to-root' class so that it's skipped when we add
    // double-click handlers in buildNestedNotebookElements. Instead, add an event handler here which just unselects
    // the current node in the treeview, effectively returning the user to the notebooks root
    if (returnToRoot) {
        back.addClass('to-root');
        back.click(function(){
            $('#tree').treeview('unselectNode', $('#tree').treeview('getSelected')[0]);
            clearTextSelection()
        });
    } else {
        back.click(function(){
            $('#tree').treeview('selectNode', parseInt($(this).attr('nodeid')));
            clearTextSelection();
        });
    }

    // Append the go-up element to a sub-row, in a centered nested column, then stick that in the shortest column,
    // which should be the first one
    var row = $('<div>')
        .addClass('row')
        .append($('<div>').addClass('col-md-10 col-md-offset-5').append(back))
        .appendTo(getShortestColumn('#notebooks-wrapper'));
}

/**
 * Builds a placeholder notebook which can be used for creating new notebooks
 **/
function buildPlaceholderNotebook(treeInitialized) {

    // If there is a currently selected notebook, get its url, otherwise set the current notebook url to null.
    var currNotebookUrl = null;
    var currTreeNodeId = null;
    if (treeInitialized) {
        try {
            currNotebookUrl = $('#tree').treeview('getSelected')[0].url;
            currTreeNodeId = $('#tree').treeview('getSelected')[0].nodeId;
        } catch(err) {}
    }

    // Build up the new notebook placeholder div
    var newNbPlaceholderText = 'New notebook...';

    var notebook = $('<div>')
        .addClass('cc-element notebook placeholder')
        .appendTo(getShortestColumn('#notebooks-wrapper'));

    $('<div>')
        .addClass('inline edit')
        .attr('contenteditable', true)
        .append(newNbPlaceholderText)
        .appendTo(notebook);

    $('<span>')
        .addClass('glyphicon glyphicon-folder-open pull-left')
        .appendTo(notebook);

    // Wire up a few event handlers to simulate a placeholder in a contenteditable div for the notebook name.
    // If the text in the div is the notebook placeholder text, focusing the div will clear the text. If the text is
    // empty when the div loses focus, it'll add back the placeholder text
    var notebookName = notebook.children('div.inline');

    // Hack around a Chrome weirdness: if you focus a contenteditable element and immediately clear its text or html,
    // it loses the focus. You have to click again to make the cursor come back. The workaround is to put the clear
    // logic on a time delay, to fire slightly after the element gains focus.
    var nameFocus = function(e) {
        var innerHandler = function() {
            if ($(e.target).text() == newNbPlaceholderText) $(e.target).text('');
        };
        setTimeout(innerHandler, 10);
    };


    // Event handler for when the thing loses focus
    var nameFocusOut = function() {

        var nbName = $(this).text().trim();

        // If the name is still the placeholder text, exit without saving
        if (nbName == newNbPlaceholderText)
            return;

        // If the name is empty, restore the placeholder text, and exit without saving
        if (!nbName) {
            $(this).text(newNbPlaceholderText);
            return;
        }

        // Make POST call to create new notebook
        $.ajax({
            url: '/api/notebooks/',
            type: 'POST',
            timeout: 1000,
            contentType: 'application/json',
            data: JSON.stringify({
                'name'  : nbName,
                'parent': currNotebookUrl,
            }),
            success: function(data){
                // Reload all user notebooks, passing in callback function which reselects the current node in the tree
                // by node ID. This works, because we just created a new notebook as a child of the current notebook.
                // No notebooks are created or deleted above the current notebook in the tree, therefore its nodeID will
                // not change
                getUserNotebooks(function(){
                    if (currTreeNodeId !== null)
                        $('#tree').treeview('selectNode', currTreeNodeId);
                });

            },
            error: function(xhr, status, err) {
                notifyError("Error creating '<strong>" + nbName + "</strong>': " + status + ".");
            }
        });
    };

    var catchKeys = function(e) {
        if (e.keyCode == 13) {
            $(this).trigger('focusout');
            e.preventDefault();
        }
    };

    // wire up the event handlers
    notebookName.on('click',    nameFocus)
                .on('focus',    function() { $(this).click(); })
                .on('focusout', nameFocusOut)
                .on('keydown',  catchKeys);
}

/**
 * Empty the notebooks portion of the content pane, and then add a notebook element for each nested notebook.
 **/
function buildNestedNotebookElements(notebook) {

    // Empty out the child columns of the #notebooks-wrapper portion of the content pane
    $('#notebooks-wrapper').children().each(function(){
        $(this).empty();
    });

    // Build the "go up" link to the parent notebook, or to the notebooks root
    // If no notebook is passed in, skip this, since we're at the root and there is no level higher up
    if (notebook) buildUpOneLevelThing(notebook);

    var notebooksToBuildUp;
    if (notebook) {
        if (notebook.nodes) {
            // If we have a notebook with nodes, those are the notebooks to place on the page
            notebooksToBuildUp = notebook.nodes;
        } else {
            // If we have a notebook with no nested notebooks, create an empty array. The forEach below won't do
            // anything, but then we continue on to wiring up double-click events. We still want to do that, so we can
            // wire up the "go up one level" div
            notebooksToBuildUp = [];
        }
    } else {
        // If we don't have a notebook, it means we're at the root. Find all root nodes and build notebook divs for those
        notebooksToBuildUp = $('#tree').treeview('getSiblings', 0);
        notebooksToBuildUp.unshift($('#tree').treeview('getNode', 0));
    }

    // Build a placeholder notebook div for creating new notebooks
    buildPlaceholderNotebook(true);

    // For each notebook under this notebook, build a notebook div and place it in the #notebooks-wrapper portion of
    // the content pane
    notebooksToBuildUp.forEach(function(nb){
        buildNotebook(nb);
    });

    // Wire up double-click event handlers for each div, using the nodeId attribute to determine which node in the
    // treeview should be selected
    $('.notebook:not(.go-up):not(.placeholder)').each(function(index, item){

        $(item).click(function(){
            $('#tree').treeview('selectNode', parseInt($(item).attr('nodeid')));
            clearTextSelection();
        })
        .find('.inline')
        .click(function(e){ e.stopPropagation(); });

    });
}

/**
 * Do a GET call to this notebook's notes list API endpoint, get an array of note objects, then run each of them through
 * buildNote to build the DOM element and insert it.
 **/
function buildNoteElements(notebook) {

    // Empty out the child columns of the #notes-wrapper portion of the content pane
    $('#notes-wrapper').children().each(function(){
        $(this).empty();
    });

    // If there is no notebook passed in, just return
    if (!notebook) return;

    buildPlaceholderNote();

    // Make an API call to get all of the notes under this notebook all at once. Then for each note returned, build up
    // a note div and stick it in the #notes-wrapper portion of the content pane
    $.ajax({
        url: notebook.url + 'notes/',
        type: 'GET',
        timeout: 1000,
        success: function(data) {
            $.each(data, function(index, note) {
                buildNote(note);
            });
        },
    });
}

/**
 * Event handler for selecting a node in the treeview. Performs an API retrieval for each note in that notebook, builds
 * an element for it in the DOM, and appends it to the content pane. Also adds notebook DOM elements to the notebooks
 * portion of the content pane.
 **/
function handleNotebookSelected(event, notebook) {
    buildNestedNotebookElements(notebook);
    buildNoteElements(notebook);
    buildBreadcrumbs(notebook);
}

/**
 * Wire up handlers to events fired by the treeview.
 **/
function wireTreeEvents() {
    $('#tree').on('nodeSelected', handleNotebookSelected);
    $('#tree').on('nodeUnselected', function() { handleNotebookSelected(null, null); });
}

/**
 * Build a hierarchical structure of notebooks, so that the Bootstrap-Treeview library can display a tree in the
 * sidebar. Pre- and post- processes the notebook objects to make sure they're suitable (proper field names, etc)
 **/
function buildTreeviewForNotebooks(notebooks, postNotebookLoadCallback) {
    notebooks = renameFieldsForTree(notebooks);                   // name->text, notebooks->nodes
    notebooks = buildTrees(notebooks, 'url', 'parent', 'nodes');  // turn flat list into nested tree structure
    notebooks = deleteEmptyNodes(notebooks);                      // make sure we don't have any empty child arrays

    if (notebooks.length == 0) {
        buildPlaceholderNotebook(false);
        return;
    }

    // Build the treeview in the #tree div in the sidebar, with specific options
    $('#tree').treeview({
        data: notebooks,
        levels: 2,

        color: '#FFFFFF',
        backColor: '#446E9B',

        selectedColor: '#446E9B',
        selectedBackColor: '#E8E8E8',

        onhoverColor: '#5488BF',

        showBorder: false,
        expandIcon: 'glyphicon glyphicon-triangle-right',
        collapseIcon: 'glyphicon glyphicon-triangle-bottom',
    });

    wireTreeEvents();
    buildNestedNotebookElements(null);

    if (postNotebookLoadCallback)
        postNotebookLoadCallback();
}

/**
 * Kick off the process to get the user's notebooks and parse into a tree for navigation in the sidebar, by making an
 * API call to the endpoint for listing all notebooks
 **/
function getUserNotebooks(postNotebookLoadCallback) {
    $.ajax({
        url: '/api/notebooks/',
        type: 'GET',
        timeout: 1000,
        success: function(data) { buildTreeviewForNotebooks(data, postNotebookLoadCallback); },
    });
}

/**
 * On document-ready
 **/
$(function(){

    // Set all ajax calls to send the CSRF token. Do *not* send the CSRF token if the request is cross-domain
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
            }
        }
    });

    var slideout = new Slideout({
        'panel': document.getElementById('panel'),
        'menu': document.getElementById('menu'),
        'padding': 250,
        'tolerance': 70
    });
    $('#menu').show();


    $('.hamburger').on('click', function() {
        $(this).toggleClass('active');
        slideout.toggle();
    });

    $.contextMenu({
        selector: '.note:not(.placeholder)',
        items: {
            "delete": {
                name: "Delete",
                icon: "delete",
                callback: function(key, options) {
                    var $note = $(this);
                    $.ajax({
                        url: $note.attr('note-url'),
                        type: 'DELETE',
                        timeout: 1000,
                        success: function() {
                            var $sibs = $note.nextAll();
                            $note.animateCss('zoomOut', function() {
                                $note.remove();
                                $sibs.animateCss('pulse');
                            });
                        },
                    });
                }
            },
        }
    });

    $.contextMenu({
        selector: '.notebook:not(.placeholder)',
        items: {
            "delete": {
                name: "Delete",
                icon: "delete",
                callback: function(key, options) {
                    var $notebook = $(this);
                    $.ajax({
                        url: $notebook.attr('url'),
                        type: 'DELETE',
                        timeout: 1000,
                        success: function() {

                            // If there is a currently selected notebook, get its url, otherwise set the current notebook url to null.
                            var currTreeNodeId = null;
                            try {
                                currTreeNodeId = $('#tree').treeview('getSelected')[0].nodeId;
                            } catch(err) {}

                            var $sibs = $notebook.nextAll();
                            $notebook.animateCss('zoomOut', function() {
                                $notebook.remove();
                                $sibs.animateCss('pulse');

                                getUserNotebooks(function(){
                                    if (currTreeNodeId !== null)
                                        $('#tree').treeview('selectNode', currTreeNodeId);
                                });

                            });
                        },
                    });
                }
            },
        }
    });

    getUserNotebooks();
});

