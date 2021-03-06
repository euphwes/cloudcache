from django.db.models import Model, CharField, IntegerField, BooleanField, ForeignKey, CASCADE

from . import Checklist
from .mixins import TrackingFieldsMixin


class ChecklistItem(TrackingFieldsMixin, Model):
    """ A cloudCache checklist item. """

    class Meta:
        ordering = ('id',)

    text = CharField(max_length=1024, blank=False)
    complete = BooleanField(default=False)
    checklist = ForeignKey(Checklist, on_delete=CASCADE, related_name='items')
    order = IntegerField(default=1)

    def __repr__(self):
        return '<ChecklistItem: {}>'.format(self.text)

    def __str__(self):
        return self.text
