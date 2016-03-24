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

// Build up a note div which contains inner note-title and note-contents class divs, with the title and content
// of a note object retrieved from the API. Do a replace-all on note.content to turn newlines into HTML line breaks
function buildNote(note) {
    var tag = $('<span>').addClass('glyphicon glyphicon-tag flipped pull-right');
    var title = $('<div>').addClass('note-title').append(note.title, tag);

    var note_content = note.content.replaceAll('\r\n', '<br>').trim();
    var content = $('<div>', {class: 'note-contents'}).append('<p>' + note_content + '</p>');

    var note = $('<div>', {class: 'note'}).append(title, content).appendTo(getShortestColumn('#notes-wrapper'));
}

/**
 * Builds up a notebook div which contains the notebook
 **/
function buildNotebook(notebook) {
    var folder = $('<span>').addClass('glyphicon glyphicon-folder-open pull-right');
    $('<div>')
      .addClass('notebook')
      .attr({'url': notebook.url, 'nodeid': notebook.nodeId})
      .append(notebook.text, folder)
      .appendTo(getShortestColumn('#notebooks-wrapper'));
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

    // Get the parent node in the treeview. If one doesn't exist, return without doing anything
    var parent = $('#tree').treeview('getParent', notebook.nodeId);
    if (parent.selector == '#tree') return;

    // Build a div which links to this notebook's parent. Put it in a nested row/column structure so that it is smaller
    // than the other notebook divs, to visually distinguish it a bit.
    var upIcon = $('<span>').addClass('glyphicon glyphicon-level-up');
    var back = $('<div>')
        .addClass('notebook go-up')
        .attr({'url': parent.url, 'nodeid': parent.nodeId})
        .append('Up', upIcon);

    var row = $('<div>')
        .addClass('row')
        .append($('<div>').addClass('col-md-10 col-md-offset-5').append(back))
        .appendTo(getShortestColumn('#notebooks-wrapper'));
}

/**
 * Empty the notebooks portion of the content pane, and then add a notebook element for each nested notebook.
 **/
function buildNestedNotebookElements(notebook) {

    // Empty out the child columns of the #notebooks-wrapper portion of the content pane
    $('#notebooks-wrapper').children().each(function(){
        $(this).empty();
    });

    // If there is no notebook passed in, just return
    if (!notebook) return;

    // Build the "go up" link to the parent notebook, if possible
    buildUpOneLevelThing(notebook);

    // For each notebook under this notebook, build a notebook div and place it in the #notebooks-wrapper portion of
    // the content pane
    if (notebook.nodes) {
        notebook.nodes.forEach(function(nb){
            buildNotebook(nb);
        });
    }

    // Wire up double-click event handlers for each div, using the nodeId attribute to determine which node in the
    // treeview should be selected
    $('.notebook').each(function(index, item){
        $(item).dblclick(function(){
            $('#tree').treeview('selectNode', parseInt($(item).attr('nodeid')));
            clearTextSelection();
        });
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

    // Make an API call to get all of the notes under this notebook all at once. Then for each note returned, build up
    // a note div and stick it in the #notes-wrapper portion of the content pane
    $.ajax({
        url: notebook.url + 'notes',
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
function buildTreeviewForNotebooks(notebooks) {
    notebooks = renameFieldsForTree(notebooks);                   // name->text, notebooks->nodes
    notebooks = buildTrees(notebooks, 'url', 'parent', 'nodes');  // turn flat list into nested tree structure
    notebooks = deleteEmptyNodes(notebooks);                      // make sure we don't have any empty child arrays

    // Build the treeview in the #tree div in the sidebar, with specific options
    $('#tree').treeview({
        data: notebooks,
        levels: 3,
        backColor: '#f5f5f5',
        selectedBackColor: '#446E9B',
        showBorder: false,
        expandIcon: 'glyphicon glyphicon-triangle-right',
        collapseIcon: 'glyphicon glyphicon-triangle-bottom',
    });

    wireTreeEvents();
}

/**
 * Kick off the process to get the user's notebooks and parse into a tree for navigation in the sidebar, by making an
 * API call to the endpoint for listing all notebooks
 **/
function getUserNotebooks() {
    $.ajax({
        url: '/api/notebooks/',
        type: 'GET',
        timeout: 1000,
        success: buildTreeviewForNotebooks,
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

    getUserNotebooks();
});

