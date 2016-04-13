$(function(){

    // -----------------------------------------------------------------------------------------------------------------
    //    Utility functions which are more general-purpose, and don't logically belong to the app controller itself
    // -----------------------------------------------------------------------------------------------------------------
    var util = {

        renderContents: function(contents) {
            var $tmp = $('<div>');
            $.each(contents.split('\r\n'), function(i, line){
                $('<p>')
                    .append(line)
                    .appendTo($tmp);
            });
            return new Handlebars.SafeString($tmp.html());
        },

        // Clear any text selection in the browser. Should work cross-browser
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

        // Ready the ajax-retrieved list of notebooks for use in the Bootstrap-Treeview tree by making it fit the format
        // that library is expecting
        massageNotebookFormat: function(notebooks) {
            notebooks = util._renameFieldsForTreeview(notebooks);
            notebooks = util._buildNested(notebooks);
            notebooks = util._deleteEmptyNodes(notebooks);
            return notebooks;
        },

        // We want to get the shortest column in the content pane, to append the current note to the end of that.
        // Check the height of each of the note-col divs inside the #notes-wrapper, find the shortest, and return that
        getShortestColumn: function(selector) {
            var minHeight = 9999999;
            var shortColumn;
            $(selector).children().each(function() {
                if ($(this).height() < minHeight) {
                    minHeight = $(this).height();
                    shortColumn = $(this);
                }
            });
            return shortColumn;
        },

    };

    // -----------------------------------------------------------------------------------------------------------------
    //                                   The cloudCache application controller object
    // -----------------------------------------------------------------------------------------------------------------
    var App = {

        tree: null,

        currNotebook: null,

        notebooks: [],
        notes: [],

        notebookTemplate: null,
        goUpTemplate: null,

        // Initialize the app controller, perform all the setup stuff necessary
        init: function() {

            Handlebars.registerHelper('render', util.renderContents);

            this.notebookTemplate = Handlebars.compile($('#notebook-template').html());
            this.goUpTemplate     = Handlebars.compile($('#go-up-template').html());
            this.noteTemplate     = Handlebars.compile($('#note-template').html());

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
            });
        },

        // Handle a new notebook being selected, firing off everything that needs to happen when a notebook is selected
        buildNestedNotebooks: function() {
            $('#notebooks-wrapper').children().empty();

            if (!this.currNotebook) return;

            util.getShortestColumn('#notebooks-wrapper').append(this.goUpTemplate({}));

            if (this.currNotebook.nodes) {
                var template = this.notebookTemplate;
                $.each(this.currNotebook.nodes, function(i, nb){
                    util.getShortestColumn('#notebooks-wrapper').append(template(nb));
                });
            }
        },

        // Handle a click of a row in the tree view
        handleTreeClick: function(e, notebookNode) {
            this.currNotebook = notebookNode;
            this.buildNestedNotebooks();

            $('#notes-wrapper').children().empty();
            this.async_loadNotes().done(function(notes){
                this.notes = notes;
                this.buildNotes();
            });
        },

        // Handle deselecting a row in the tree view
        handleTreeUnselect: function(e, notebookNode) {
            this.currNotebook = null;
            this.buildNestedNotebooks();
            $('#notes-wrapper').children().empty();
        },

        // Handle a click of a notebook button. Get the associated treeview node for that button, set that as the
        // current notebook, then fire off the notebook-selected function.
        handleNotebookClick: function(e) {

            util.clearTextSelection();

            var $notebook = $(e.target);
            // If the user clicked the folder icon/span instead, get the parent element (the notebook itself)
            if ($notebook.prop('tagName') == 'SPAN') $notebook = $notebook.parent();

            this.currNotebook = this.tree.getNode($notebook.attr('data-nodeId'));
            this.tree.selectNode(this.currNotebook, {silent: true});
            this.tree.revealNode(this.currNotebook, {silent: true});
            this.buildNestedNotebooks();

            $('#notes-wrapper').children().empty();
            this.async_loadNotes().done(function(notes){
                this.notes = notes;
                this.buildNotes();
            });
        },

        // Handle clicking on the "go up" button, navigating the user back up the notebook structure
        handleGoUpClick: function() {

            this.currNotebook = this.tree.getParent(this.currNotebook.nodeId);

            if (!this.currNotebook) {
                this.currNotebook = null;
                this.tree.unselectNode(this.tree.getSelected()[0], {silent: true});
            } else {
                this.tree.selectNode(this.currNotebook, {silent: true});
                this.tree.revealNode(this.currNotebook, {silent: true});
            }

            this.handleNotebookSelect();
        },

        // Wire up events for notebooks and notes
        wireEvents: function() {

            // Wire the notebook-click event, but disable the event firing if the user clicks on the edit text
            // inside the notebook element
            $('#notebooks-wrapper').on('click', '.notebook:not(.go-up)', this.handleNotebookClick.bind(this))
                .find('.edit')
                .click(function(e){ e.stopPropagation(); });

            $('#notebooks-wrapper').on('click', '.go-up', this.handleGoUpClick.bind(this));
        },

        buildNotes: function() {
            var template = this.noteTemplate;
            $.each(this.notes, function(i, note){
                $(template(note))
                    .appendTo(util.getShortestColumn('#notes-wrapper'))
                    .animateCss('fadeIn');
            });
        },

        // Kick off the process to get the user's notebooks and parse into a tree for navigation in the sidebar, by
        // making an API call to the endpoint for listing all notebooks
        async_loadNotebooks: function () {
            return $.ajax({
                context: this,
                url: '/api/notebooks/',
                type: 'GET',
                timeout: 5000,
            }).then(util.massageNotebookFormat);
        },

        // Load all the notes for the current notebook
        async_loadNotes: function() {
            return $.ajax({
                context: this,
                url: this.currNotebook.url + 'notes/',
                type: 'GET',
                timeout: 1000,
            });
        },

        // Build notebook treeview in the sidebar.
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

        // Build the slide-out menu, and attach a click handler to the hamburger icon.
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

    // Extension to jQuery to easily animate elements with animate.css, then remove the animations when complete
    $.fn.extend({
        animateCss: function (animationName, finishCallback) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            $(this).addClass('animated ' + animationName).one(animationEnd, function() {
                $(this).removeClass('animated ' + animationName);
                if (finishCallback) finishCallback();
            });
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

    App.init();
});