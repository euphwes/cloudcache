
function treeify(list, idAttr, parentAttr, childrenAttr) {
    if (!idAttr) idAttr = 'url';
    if (!parentAttr) parentAttr = 'parent';
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
}


function recursivelyRemoveEmptyNodesArrays(notebooks) {

    for (var i = 0; i < notebooks.length; i++){
        nb = notebooks[i];
        if (nb.nodes.length == 0) {
            delete nb.nodes;
        }
        else {
            nb.nodes = recursivelyRemoveEmptyNodesArrays(nb.nodes);
        }
    }

    return notebooks;
}


function getUserNotebooks() {
    var get_url = '/api/notebooks/';

    var notebooks;

    // Make the API GET call
    $.ajax({
        url: get_url,
        type: 'GET',
        timeout: 1000,
        success: function(notebooks) {

            for (var i = 0; i < notebooks.length; i++) {
                notebooks[i].text = notebooks[i].name;
                notebooks[i].nodes = notebooks[i].notebooks;
                delete notebooks[i].name;
                delete notebooks[i].notebooks;
            }

            notebooks = treeify(notebooks);
            notebooks = recursivelyRemoveEmptyNodesArrays(notebooks);

            $('#tree').treeview({
                data: notebooks,
                levels: 3,
                backColor: '#f5f5f5',
                selectedBackColor: '#446E9B',
                showBorder: false,
            });

        }
    });


}

$(function(){

    // Set all ajax calls to send the CSRF token
    // Do *not* send the CSRF token if the request is cross-domain
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
            }
        }
    });

    getUserNotebooks();
});

