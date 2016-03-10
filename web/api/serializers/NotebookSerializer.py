from cloudcache.models import Notebook
from rest_framework.serializers import HyperlinkedModelSerializer

# ----------------------------------------------------------------------------------------------------------------------

class NotebookSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Notebook model list and detail endpoints. """

    class Meta:
        model = Notebook
        fields = ('id', 'name', 'owner', 'parent', 'created', 'modified', 'url')

        extra_kwargs = {
            'id': {'read_only': True},    # Shouldn't be able to edit ID
        }
