// Utility function to get a cookie by name
function getCookie(name) {
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
function csrfSafeMethod(method) {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

// Clear any text selection in the browser. Should work cross-browser
function clearTextSelection() {
    if (window.getSelection) {
      if (window.getSelection().empty) {  // Chrome
        window.getSelection().empty();
      } else if (window.getSelection().removeAllRanges) {  // Firefox
        window.getSelection().removeAllRanges();
      }
    } else if (document.selection) {  // IE?
      document.selection.empty();
    }
}

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
 * Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be called
 * after it stops being called for N milliseconds. If `immediate` is passed, trigger the function on the leading edge,
 * instead of the trailing.
 **/
function debounce(func, wait, immediate) {
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
}

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

/**
 * Since none of the Glyphicons are present in the page at page-load, Bootstrap doesn't need to load the Glyphicons
 * web font until we retrieve notebooks via API, then build the notebooks DOM elements. Unfortunately, this causes
 * the icon to not display until it loads for the first time, a fraction of a second later, causing a flashing effect.
 *
 * Here, we "preload" the Glyphicons before getting user notebooks by inserting, hiding, and immediately removing a DOM
 * element which contains a Glypicon. For this to be effective, it needs to be called before calling getUserNotebooks()
 * for the first time.
 **/
function preloadGlyphicons(){
    $('<div>')
        .attr('style', 'height:0px; width:0px;')
        .addClass('glyphicon glyphicon-folder-open')
        .appendTo($('#panel'))
        .hide()
        .remove();
}

// Set all ajax calls to send the CSRF token. Do *not* send the CSRF token if the request is cross-domain
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
        }
    }
});