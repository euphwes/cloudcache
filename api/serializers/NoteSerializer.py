from cloudcache.models import Note
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class NoteSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Note model list and detail endpoints. """

    class Meta:
        model = Note
        fields = ('id', 'title', 'content', 'owner', 'created', 'modified', 'url', 'category')

        extra_kwargs = {
            'id': {'read_only': True},    # Shouldn't be able to edit ID
        }

    def __init__(self, *args, **kwargs):
        """ Custom __init__ to make the browseable API a bit more user-friendly. """

        super().__init__(*args, **kwargs)

        try:
            # Assume there is a context and nested HTTP request in the kwargs
            # Only show Notebooks owned by the currently logged-in user in the `notebook` dropdown
            owner = kwargs['context']['request'].user

        except KeyError:
            # This would pop if there is no `context` in the kwargs, or `request` in the context. This would just mean
            # that the serializer is being used outside of a web context, so we can use the `notebook` default queryset
            pass
