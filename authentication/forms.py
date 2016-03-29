from django.forms import ModelForm, CharField, PasswordInput, ValidationError
from .models import Account

# ----------------------------------------------------------------------------------------------------------------------

class AccountCreationForm(ModelForm):
    """ Custom Account creation form. """

    class Meta:
        model = Account
        fields = ('username', 'email')

    # Define these outside of the Meta class fields attribute above, because we want to manually specify labels,
    # and also the PasswordInput widget so the password is masked rather than visible
    password = CharField(label='Password', widget=PasswordInput)
    confirm_password = CharField(label='Confirm password', widget=PasswordInput)


    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for key in self.fields:
            self.fields[key].required = True


    def clean(self):
        """ Validate the form by cleaning it. Confirm both password fields were entered, and that they match. """

        cleaned_data = super().clean()

        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')

        if (password and confirm_password) and (password != confirm_password):
            raise ValidationError('Passwords do not match.')

        #TODO: should we use django.contrib.auth.password_validation to further validate password? see example at
        #TODO: github.com/django/django/blob/master/django/contrib/auth/forms.py, UserCreationForm.clean_password2


    def save(self, commit=True):
        """ Save the data from our form into an object, and return that to the caller.
        
        :param commit: Whether or not to commit the Account saved from the form to the database before returning it.
        :return: The newly created Account object.
        """

        account = super().save(commit=False)
        account.set_password(self.cleaned_data['password'])

        if commit:
            account.save()

        return account
