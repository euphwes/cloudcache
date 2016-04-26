from django.db.models import Model, CharField, ForeignKey, CASCADE

from . import Notebook
from .mixins import TrackingFieldsMixin

class Checklist(TrackingFieldsMixin, Model):
    """ A cloudCache checklist. """

    class Meta:
        ordering = ('id',)

    title = CharField(max_length=1024, blank=False)
    notebook = ForeignKey(Notebook, on_delete=CASCADE, related_name='checklists')

    def __repr__(self):
        return '<Checklist: {}>'.format(self.title)

    def __str__(self):
        return self.title
