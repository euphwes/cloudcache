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

// Add a replaceAll method to the String prototype so we can replace all instances of matching text within a string
// instead of just the first instance
String.prototype.replaceAll = function(search, replace)
{
    // If 'replace' argument is not sent, return original string otherwise it will replace with 'undefined'
    if (replace === undefined) return this.toString();
    return this.replace(new RegExp('[' + search + ']', 'g'), replace);
}