function getTree() {
    return [
      {
        text: "Personal",
        nodes: [
          {
            text: "House stuff",
            nodes: [
              {
                text: "Appliances"
              },
              {
                text: "Furniture",
              }
            ]
          },
          {
            text: "Computer stuff",
            nodes: [
                {
                    text: "Latest PC build",
                },
            ]
          }
        ]
      },
      {
        text: "Work",
        nodes: [
            {
                text: "InfoDynamics",
            },
            {
                text: "The Breakaway Group",
            }
        ]
      },
    ];
}


function getUserNotebooks() {
    var get_url = '/api/notebooks/';

    var onSuccess = function(jqXHR) {
        console.log(jqXHR);
    };

    // Make the API GET call
    return $.ajax({
        url: get_url,
        type: 'GET',
        timeout: 1000,
        success: onSuccess,
    });

}

$(function(){

    $('#tree').treeview({
        data: getTree(),
        levels: 3,
        backColor: '#f5f5f5',
        selectedBackColor: '#446E9B',
        showBorder: false,
    });

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

