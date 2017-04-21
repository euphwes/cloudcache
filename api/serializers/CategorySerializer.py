from cloudcache.models import Category
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class CategorySerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Category model list and detail endpoints. """

    class Meta:
        model = Category
        fields = ('id', 'owner', 'name', 'created', 'modified', 'url', 'checklists', 'notes')

        extra_kwargs = {
            'id': {'read_only': True},  # Shouldn't be able to edit ID
            'checklists': {'read_only': True},  # Shouldn't be able to edit lists, do that in lists details
            'notes': {'read_only': True},  # Shouldn't be able to edit lists, do that in notes details
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