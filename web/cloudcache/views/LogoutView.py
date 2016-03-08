from django.shortcuts import redirect
from django.views.generic import View
from django.contrib.auth import logout
from django.core.urlresolvers import reverse

# ----------------------------------------------------------------------------------------------------------------------

class LogoutView(View):
    """ Super-simple view to log out the currently logged-in User, and then redirect back to the login page. """

    def get(self, request):
        logout(request)
        return redirect(reverse('cloudcache:login'))
