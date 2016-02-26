from django.db.models import Model, DateTimeField


class TrackingFieldsMixin(Model):
    """ A Django model mixin which provides easy creation and update timestamp functionality. """

    class Meta:
        abstract = True

    created = DateTimeField(auto_now_add=True)
    modified = DateTimeField(auto_now=True)

