from cloudcache.models import Notebook
from authentication.models import Account
from rest_framework.serializers import HyperlinkedModelSerializer, HyperlinkedRelatedField

# ----------------------------------------------------------------------------------------------------------------------

class NotebookSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Notebook model list and detail endpoints. """

    notebooks = HyperlinkedRelatedField(many=True, read_only=True, view_name='notebook-detail')

    class Meta:
        model = Notebook
        fields = ('id', 'name', 'owner', 'parent', 'notebooks', 'created', 'modified', 'url')

        extra_kwargs = {
            'id': {'read_only': True},    # Shouldn't be able to edit ID
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
