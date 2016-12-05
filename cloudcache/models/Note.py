from django.db.models import Model, CharField, ForeignKey, TextField, CASCADE
from django.conf import settings
from .mixins import TrackingFieldsMixin


class Note(TrackingFieldsMixin, Model):
    """ A cloudCache note. """

    class Meta:
        ordering = ('id',)

    owner = ForeignKey(settings.AUTH_USER_MODEL, related_name='notes')
    title = CharField(max_length=1024, blank=False)
    content = TextField(blank=False)

    def __repr__(self):
        return '<Note: {}>'.format(self.title)

    def __str__(self):
        return self.title
