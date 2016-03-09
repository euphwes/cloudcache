from django.contrib.auth.decorators import login_required

# ----------------------------------------------------------------------------------------------------------------------

class LoginRequiredMixin(object):
    """ Simple class mixin to make a view require login. """

    @classmethod
    def as_view(cls, **kwargs):
        view = super(LoginRequiredMixin, cls).as_view(**kwargs)
        return login_required(view)

# ----------------------------------------------------------------------------------------------------------------------

from .HomePageView import HomePageView
from .LogoutView import LogoutView
from .UserRegistrationView import UserRegistrationView
