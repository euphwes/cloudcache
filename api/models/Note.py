from django.db.models import Model, CharField, ForeignKey, TextField, CASCADE

from . import Notebook


class Note(Model):
    """ A cloudCache note. """

    class Meta:
        ordering = ('id',)

    title = CharField(max_length=1024, blank=False)
    content = TextField(blank=False)
    notebook = ForeignKey(Notebook, on_delete=CASCADE, related_name='notes')

    def __repr__(self):
        return '<Note: {}>'.format(self.title)

    def __str__(self):
        return self.title
