
/**
 * General utility function for turning a flat list of objects into a nested structure. The ID, parent, and children
 * attributes' names are configurable, but it's assumed that each object coming in has a unique ID, and that each object
 * either identifies a parent object by ID or identifies a null parent (meaning it's the root of a tree).
 **/
function buildTrees(list, idAttr, parentAttr, childrenAttr) {
    if (!idAttr) idAttr = 'id';
    if (!parentAttr) parentAttr = 'parent';
    if (!childrenAttr) childrenAttr = 'children';

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
}

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

// We want to get the shortest column in the content pane, to append the current note to the end of that.
// Check the height of each of the note-col divs inside the #notes-wrapper, find the shortest, and return that
function getShortestColumn() {
    var minHeight = 9999999;
    var shortColumn;
    $('#notes-wrapper').children().each(function() {
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
    var title = $('<div>', {class: 'note-title'}).append(note.title);
    var note_content = note.content.replaceAll('\r\n', '<br>').trim();
    var content = $('<div>', {class: 'note-contents'}).append('<p>' + note_content + '</p>');
    var note = $('<div>', {class: 'note'}).append(title, content);
    getShortestColumn().append(note);
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
        var crumb = $('<li>').addClass('active').append('Notebooks');
        $('#breadcrumbs').prepend(crumb);
        return;
    }

    // Make the last element the active element with the current notebook's name
    var crumb = $('<li>').addClass('active').append(notebook.text);
    $('#breadcrumbs').prepend(crumb);

    // Keep climbing the tree, finding each parent notebook, until we reach the top. For each parent notebook, prepend
    // an ol->li element with that notebook's name
    var parent = $('#tree').treeview('getParent', notebook);
    while (parent.selector != '#tree') {
        var anchorId = 'crumb' + parent.nodeId;
        var anchor = $('<a href="#">').attr('id', anchorId).append(parent.text);
        var crumb = $('<li>').append(anchor);
        $('#breadcrumbs').prepend(crumb);
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
 * Event handler for selecting a node in the treeview. Performs an API retrieval for each note in that notebook, builds
 * an element for it in the DOM, and appends it to the content pane.
 **/
function handleNotebookSelected(event, notebook) {

    buildBreadcrumbs(notebook);

    // Do an API get on each note contained by this notebook, and when it succeeds, run it through buildNote
    notebook.notes.forEach(function(note) {
        var blah = $.ajax({
            url: note,
            type: 'GET',
            timeout: 1000,
            success: buildNote,
        });
    });
}

/**
 * Wire up handlers to events fired by the treeview.
 **/
function wireTreeEvents() {
    var tree = $('#tree');
    tree.on('nodeSelected',handleNotebookSelected);
    tree.on('nodeUnselected', function() {
        $('#notes-wrapper').children().each(function() {
            $(this).empty();
            buildBreadcrumbs(null);
        });
    });
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

