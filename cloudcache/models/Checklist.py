from django.db.models import Model, CharField, ForeignKey
from django.conf import settings
from .mixins import TrackingFieldsMixin

class Checklist(TrackingFieldsMixin, Model):
    """ A cloudCache checklist. """

    class Meta:
        ordering = ('id',)

    owner = ForeignKey(settings.AUTH_USER_MODEL, related_name='lists')
    title = CharField(max_length=1024, blank=False)

    def __repr__(self):
        return '<Checklist: {}>'.format(self.title)

    def __str__(self):
        return self.title
