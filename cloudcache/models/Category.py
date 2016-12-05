from django.db.models import Model, CharField, ForeignKey, TextField
from django.conf import settings
from .mixins import TrackingFieldsMixin


class Category(TrackingFieldsMixin, Model):
    """ A cloudCache category. """

    class Meta:
        ordering = ('id',)

    owner = ForeignKey(settings.AUTH_USER_MODEL, related_name='categories')
    name = CharField(max_length=1024, blank=False)

    def __repr__(self):
        return '<Category: {}>'.format(self.name)

    def __str__(self):
        return self.name
