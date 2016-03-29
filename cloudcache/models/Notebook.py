from django.db.models import Model, CharField, ForeignKey, CASCADE
from django.conf import settings

from .mixins import TrackingFieldsMixin


class Notebook(TrackingFieldsMixin, Model):
    """ A cloudCache notebook, which may contain additional notebooks and/or notes. """

    class Meta:
        ordering = ('id',)

    name = CharField(max_length=1024, blank=False)
    owner = ForeignKey(settings.AUTH_USER_MODEL, related_name='notebooks')
    parent = ForeignKey('self', on_delete=CASCADE, related_name='notebooks', null=True)

    def __repr__(self):
        return '<Notebook: {}>'.format(self.name)

    def __str__(self):
        return self.name