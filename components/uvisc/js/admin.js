(function() {

  /**
   * Job view used in table
   */
  App.Views.Job = App.Views.Job.extend({
    /**
     * set up click events
     */
    events: {
      'click .jobTitle': 'viewJob',
      'click .delete': 'deleteJob',
      'click .publish': 'publishJob'
    },
    
    /**
     * set ap application event listeners
     */
    initialize: function() {
      this.model.on('change', this.render , this);
      this.model.on('destroy', this.remove, this);
    },

    /**
     * click the delete button event and destroy the model
     */
    deleteJob: function(e) {
      e.preventDefault();
      this.model.destroy();
    },

    /**
     * remove the element once it's been destroyed
     */
    remove: function() {
      this.$el.remove();
    },

    /**
     * publish or unpublish a job offer
     */
    publishJob: function() {
      this.model.save({ published: !this.model.get('published') });
    }
  });

  /**
   * admin login view
   */
  App.Views.AdminLogin =  Backbone.View.extend({
    el: '#login',

    /**
     * set up submit event
     */
    events: {
      'submit #loginForm' : 'login'
    },

    /**
     * listen to status 401 to show the log in form
     */
    initialize: function() {
      App.Events.on('status_401', this.show, this);
    },

    /**
     * submit login form and check credentials in the server
     * if the login is valid set the returned auth token in all ajax requests
     *
     * @param event
     */
    login: function(e) {
      $.post(
        'users/authentication',
        {
          username: this.$el.find('#username').val(),
          password: this.$el.find('#password').val()
        },
        _.bind(function(data) { // login success
          $.ajaxSetup({
            headers: {
              'auth-token': data.token,
              'auth-admin': true
            }
          });

          // click event on logo
          $('#logo').on('click', function(e) {
            App.Events.trigger('home');
            router.navigate('', true);
          });

          this.$el.hide();
          App.Events.trigger('showListings');
          this.$el.find('#username').val('');
          this.$el.find('#password').val('');
        }, this),
        'json'
      )
      .fail(_.bind(function() { // username or password is not valid
        this.$el.find('#errorMessage').show();
      }, this));
      e.preventDefault();
    },

    /**
     * show the login view
     */
    show: function() {
      $.ajaxSetup({
        headers: {
          'auth-token': null,
          'auth-admin': false
        }
      });
      this.$el.find('#errorMessage').hide();
      this.$el.show();
      this.$el.find('#username').focus();
    }
  });

  /**
   * JobView view
   */
  App.Views.JobView = App.Views.JobView.extend({
    events: {
      'click #back': 'back',
      'click .delete' : 'delete',
      'click .publish' : 'publish',
      'click #edit': 'edit'
    },
    initialize: function() {
      App.Events.on('showJob', this.showJob, this);
      App.Events.on('home status_404 status_401', this.hide, this);
    },

    /**
     * if there's a model set the change and destroy listeners
     */
    render: function() {
      if(this.model) {
        var model = this.model.toJSON();
        model.description = markdown.toHTML(parseDescription(model.description));
        this.$el.html( this.template(model) );
        this.model.on('change', this.update , this);
        this.model.on('destroy', this.remove, this);
      }
      this.$el.show();
    },

    /**
     * if the job view is visible and the model is updated render the view to update it too
     */
    update: function() {
      if(this.$el.is(':visible')) {
        this.render();
      }
    },

    /**
     * show edit email form
     */
    edit: function(e) {
      e.preventDefault();
      this.model.fetch({
        success: _.bind(function(model, response, options) {
          this.hide();
          App.Events.trigger('editJobForm', model);
        }, this),
        error: function(collection, response, options) {
          App.Events.trigger('status_' +  response.status);
        }
      });
    },

    /**
     * click the delete button to destroy the model
     *
     * @param event
     */
    delete: function(e) {
      e.preventDefault();
      this.model.destroy();
    },

    /**
     * once the model has been removed hide the element and show the listings view
     */
    remove: function() {
      this.hide();
      App.Events.trigger('showListings');
    },

    /**
     * publish or unpublish a job offer
     *
     * @param event
     */
    publish: function(e) {
      e.preventDefault();
      this.model.save({ published: !this.model.get('published') });
    }
  });

  /**
   * overwrite the Jobs view to add a collection on destroy event handler
   * this event handler will reload the current page to keep the collection pagination 
   * data up to date
   */
  App.Views.Jobs = App.Views.Jobs.extend({

    /**
     * initialize view, cache dom elements and set up application event listeners
     */
    initialize: function() {
      this.dom.jobs = this.$el.find('#jobs');
      this.dom.empty = this.$el.find('#empty');
      this.dom.loadMore = this.$el.find('#loadMore');
      this.dom.searchForm = this.$el.find('#searchForm');

      this.collection = new App.Collections.Jobs();
      this.collection.on('add', this.addOne, this);
      this.collection.on('destroy', this.reload, this);
      App.Events.on('showListings', this.showListings, this);
      App.Events.on('showJob addJob status_404 status_401', this.hideListings, this);
      App.Events.on('home', this.home, this);
    },

    /**
     * reload listings when a job offer is removed to keep the pagination up to date
     */
    reload: function() {
      this.collection.pagination.page -= 1;
      this.loadMore();
    }
  });

})();