from django.conf.urls import url

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse

from .views.public import AccountList, AccountDetail, NoteList, NoteDetail, ChecklistList, ChecklistDetail,\
    ChecklistItemList, ChecklistItemDetail, ChecklistItemsList, CategoryList, CategoryDetail

# ----------------------------------------------------------------------------------------------------------------------

@api_view(('GET',))
def api_root(request, format=None):
    """ Main entry point for the API. """

    return Response({
        'accounts': reverse('account-list', request=request, format=format),
        'notes': reverse('note-list', request=request, format=format),
        'categories': reverse('category-list', request=request, format=format),
        'checklists': reverse('checklist-list', request=request, format=format),
        'checklist items': reverse('checklistitem-list', request=request, format=format),
    })

# ----------------------------------------------------------------------------------------------------------------------

urlpatterns = [
    # API root
    url(r'^$', api_root),

    # authentication.models.Account list and detail views
    url(r'^accounts/$', AccountList.as_view(), name='account-list'),
    url(r'^accounts/(?P<pk>[0-9]+)/$', AccountDetail.as_view(), name='account-detail'),

    # cloudcache.models.Category list and detail views
    url(r'^categories/$', CategoryList.as_view(), name='category-list'),
    url(r'^categories/(?P<pk>[0-9]+)/$', CategoryDetail.as_view(), name='category-detail'),

    # cloudcache.models.Note list and detail views
    url(r'^notes/$', NoteList.as_view(), name='note-list'),
    url(r'^notes/(?P<pk>[0-9]+)/$', NoteDetail.as_view(), name='note-detail'),

    # cloudcache.models.Checklist list and detail views
    url(r'^checklists/$', ChecklistList.as_view(), name='checklist-list'),
    url(r'^checklists/(?P<pk>[0-9]+)/$', ChecklistDetail.as_view(), name='checklist-detail'),

    # cloudcache.models.ChecklistItem list and detail views
    url(r'^checklistitems/$', ChecklistItemList.as_view(), name='checklistitem-list'),
    url(r'^checklistitems/(?P<pk>[0-9]+)/$', ChecklistItemDetail.as_view(), name='checklistitem-detail'),

    # cloudcache.models.Checklist nested ChecklistItem list
    url('^checklists/(?P<pk>[0-9]+)/items/$', ChecklistItemsList.as_view(), name='checklist-items-list'),
]
