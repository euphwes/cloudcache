from django.shortcuts import render, redirect
from django.views.generic import View
from django.core.urlresolvers import reverse

from authentication.forms import AccountCreationForm

# ----------------------------------------------------------------------------------------------------------------------

class UserRegistrationView(View):
    """ View for processing User registration. """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.template = 'registration/user_registration.html'
        self.success_flag = r'?success=true'


    def get(self, request):
        """ Provides the empty registration form. If we're redirecting here from a successful POST, and new Account was
        created, then set a flag so the template knows to render a success alert/banner. """

        return render(request, self.template, {'new_registration_success': 'success' in request.GET})


    def post(self, request):
        """ Handles submission of a new User registration. """

        # Build the form from the POST data
        acct_creation_form = AccountCreationForm(request.POST)

        # If the form is valid, create the account from the form data by saving the form and commit to database.
        # Redirect back to this page, with a success flag set.
        if acct_creation_form.is_valid():
            acct_creation_form.save(commit=True)
            return redirect(reverse('cloudcache:register') + self.success_flag)

        # If the form is invalid, re-display the page with the relevant errors in the form
        else:
            context = {'form': acct_creation_form}
            return render(request, self.template, context)
