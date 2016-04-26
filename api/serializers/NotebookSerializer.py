from cloudcache.models import Notebook
from authentication.models import Account
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class NotebookSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Notebook model list and detail endpoints. """

    class Meta:
        model = Notebook
        fields = ('id', 'name', 'owner', 'parent', 'notebooks', 'notes', 'checklists', 'created', 'modified', 'url')

        extra_kwargs = {
            'id': {'read_only': True},          # Can't edit ID
            'notes': {'read_only': True},       # Can't edit the contained notes here, do that in the Note detail view
            'notebooks': {'read_only': True},   # Can't edit contained notebooks here, do that in Notebook detail view
            'checklists': {'read_only': True},  # Ditto
        }


    def __init__(self, *args, **kwargs):
        """ Custom __init__ to make the browseable API a bit more user-friendly. """

        super().__init__(*args, **kwargs)

        try:
            # Assume there is a context and nested HTTP request in the kwargs
            # Only show Notebooks owned by the currently logged-in user in the `parent` dropdown
            # Only show the currently logged-in user in the `owner` dropdown
            user = kwargs['context']['request'].user
            self.fields['parent'].queryset = Notebook.objects.filter(owner=user)
            self.fields['owner'].queryset = Account.objects.filter(id=user.id)

        except KeyError:
            # This would pop if there is no `context` in the kwargs, or `request` in the context. This would just mean
            # that the serializer is being used outside of a web context, therefore we can use the `parent` and `owner`
            # default querysets
            pass
