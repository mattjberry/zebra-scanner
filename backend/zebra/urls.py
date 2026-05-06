from django.urls import path
from . import views

urlpatterns = [
    path('process/', views.process_zebra, name='process_zebra'),
]