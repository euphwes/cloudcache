from cloudcache.models import Checklist
from rest_framework.serializers import HyperlinkedModelSerializer

from . import ChecklistItemSerializer

# ----------------------------------------------------------------------------------------------------------------------

class ChecklistSerializer(HyperlinkedModelSerializer):
    """ Serializer for read/write actions on the Checklist model list and detail endpoints. """

    items = ChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Checklist
        fields = ('id', 'title', 'owner', 'items', 'created', 'modified', 'url', 'category')

        extra_kwargs = {
            'id': {'read_only': True},     # Shouldn't be able to edit ID
        }