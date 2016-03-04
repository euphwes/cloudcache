from django.db.models import CharField, EmailField, BooleanField, DateTimeField
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager

# ----------------------------------------------------------------------------------------------------------------------


class AccountManager(BaseUserManager):
    """ Simple account manager for the Account user model above. """

    def create_user(self, username, email, password):
        """ Create a normal (non-admin) user.
        :param username: The user's username
        :param email: The user's email address
        :param password: The user's password
        :return: The newly-created user
        """

        if not email:
            raise ValueError('Users must have a valid email address.')

        if not username:
            raise ValueError('Users must have a valid username.')

        # since self.model is not defined in AccountManager, it defaults to BaseUserManager's, which gets the settings'
        # AUTH_USER_MODEL (which we have defined as the Account model above)
        account = self.model(email=self.normalize_email(email), username=username)

        account.set_password(password)
        account.save()

        return account


    def create_superuser(self, username, email, password):
        """ Create an admin user.
        :param username: The user's username
        :param email: The user's email address
        :param password: The user's password
        :return: The newly-created user
        """

        account = self.create_user(username, email, password)

        account.is_admin = True
        account.save()

        return account


class Account(AbstractBaseUser):
    """ Simple user account, email and username only. """

    email      = EmailField(unique=True)
    username   = CharField(max_length=40, unique=True)
    is_admin   = BooleanField(default=False)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)

    objects = AccountManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ('username', 'email')

    def __unicode__(self):
        return self.email

    def get_full_name(self):
        return self.username

    def get_short_name(self):
        return self.username
