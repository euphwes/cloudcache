$(function(){

    var App = {

        notebooks: [],

        init: function() {

            preloadGlyphicons();

            // register this with enquire.js so that if the the screen size changes and media queries are matched
            // or unmatched, the slideout size params are rebuilt and the toggle mechanism is reattached to the button
            this.buildMenu();
            enquire.register('only screen and (max-device-width: 480px)', {
                  match: this.buildMenu,
                unmatch: this.buildMenu,
            });

            this.loadNotebooks().done(function(data){
                this.notebooks = data;
                this.buildTree();
            });
        },

        /**
         * Kick off the process to get the user's notebooks and parse into a tree for navigation in the sidebar, by making an
         * API call to the endpoint for listing all notebooks
         **/
        loadNotebooks: function () {
            return $.ajax({
                context: this,
                url: '/api/notebooks/',
                type: 'GET',
                timeout: 5000,
            }).then(function(data){
                var notebooks = renameFieldsForTree(data);                   // name->text, notebooks->nodes
                notebooks = buildTrees(notebooks, 'url', 'parent', 'nodes');  // turn flat list into nested tree structure
                notebooks = deleteEmptyNodes(notebooks);                      // make sure we don't have any empty child arrays
                return notebooks;
            });
        },

        /**
         * Build a hierarchical structure of notebooks, so that the Bootstrap-Treeview library can display a tree in the
         * sidebar. Pre- and post- processes the notebook objects to make sure they're suitable (proper field names, etc)
         **/
        buildTree: function() {
            var notebooks = this.notebooks;

            if (notebooks.length == 0) {
                //buildPlaceholderNotebook(false);
                return;
            }

            // Build the treeview in the #tree div in the sidebar, with specific options
            $('#tree').treeview({
                data: notebooks,
                levels: 2,
                showBorder: false,
                expandIcon: 'glyphicon glyphicon-triangle-right',
                collapseIcon: 'glyphicon glyphicon-triangle-bottom',
            });

            //wireTreeEvents();
            //buildNestedNotebookElements(null);
        },

        buildMenu: function() {
            var slideout = new Slideout({
                'panel': document.getElementById('panel'),
                'menu': document.getElementById('menu'),
                'padding': $('.slide-menu').css('width'),
                'tolerance': 70
            });
            $('.hamburger').off('click').on('click', function() {
                $(this).toggleClass('active');
                slideout.toggle();
            });
            $('#menu').show();
        },
    };

    App.init();

});