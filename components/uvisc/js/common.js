(function() {

  /**
   * main application container
   */
  window.App = {
    Name: document.title,
    Models: {},
    Collections: {},
    Views: {},
    Router: {},
    Events: _.extend({}, Backbone.Events),
    Base: '/'
  };

  /**
   * set application base path
   */
  if($('base').length) {
    App.Base = $('base').attr('href');
  }

  /**
   * return a template from the html using an element's id
   *
   * @param string id
   */
  window.template = function(id) {
      return _.template($('#' + id).html());
  };

  /**
   * parse the markdown description to get rid of links and images
   *
   * @param string description
   */
  window.parseDescription = function(description) {
    description = markdown.parse( description );

    // iterate through the tree finding link and image references
    ( function find_link_refs( jsonml ) {
      jsonml.forEach(function(jsonml, index) {
        if ( Array.isArray( jsonml ) ) {
          if ( jsonml[ 0 ] === "link" ) {
            jsonml[ 0 ] = 'span';
            jsonml[ 1 ] = jsonml[ 2 ];
            jsonml[ 2 ] = '';
          } else if( jsonml[ 0 ] == "img") {
            jsonml[ 0 ] = 'span';
            jsonml[ 1 ] = jsonml[ 1 ].alt;
          }
          find_link_refs(jsonml)
        }
      })
    } )( description );

    return description;
  };

  /******************
   ***** ROUTER *****
   ******************/

  /**
   * create the application routes
   */
  App.Router = Backbone.Router.extend({
    routes: {
      '': 'index',
      'jobs/add': 'addJob',
      'jobs/edit/:id/:code' : 'editJob',
      'jobs/:id': 'viewJob',
      'jobs/:id/:code' : 'updateJob',
      '*default': 'notFound'
    },

    /**
     * default route shows job listings
     */
    index: function() {
      App.Events.trigger('showListings');
    },

    /**
     * show a job offer specified by id
     *
     * @param int id
     */
    viewJob: function(id) {
      var job = new App.Models.Job({ id: id });
      job.fetch({
        success: function() {
          App.Events.trigger('showJob', job);
        },
        error: function(collection, response, options) {
          App.Events.trigger('status_' +  response.status);
        }
      });
    },

    /**
     * update a job offer specified by id using the code token
     * it's used to publish a job offer using an emailed token
     *
     * @param int id
     * @param string code
     */
    updateJob: function(id, code) {
      var job = new App.Models.Job({ id: id });
      job.set('published', true);
      job.save(
        null,
        {
          beforeSend: function(xhr) {
            xhr.setRequestHeader('UPDATE-TOKEN', code);
          },
          success: function(model, response, options) {
            App.Events.trigger('showJob', model);
          },
          error: function(collection, response, options) {
            App.Events.trigger('status_' +  response.status);
          }
      });
    },

    /**
     * trigger the addJob event to display the jobs form
     */
    addJob: function() {
      App.Events.trigger('addJob');
    },

    /**
     * check if the user has permission to edit a job offer
     * using a token
     *
     * @param int id
     * @param string token
     */
    editJob: function(id, token) {
      var job = new App.Models.Job({ id: id });
      $.ajaxSetup({
        headers: {
          'UPDATE-TOKEN': token
        }
      });
      job.fetch({
        success: function(model, response, options) {
          App.Events.trigger('editJobForm', model);
        },
        error: function(collection, response, options) {
          App.Events.trigger('status_' +  response.status);
        }
      });
    },

    /**
     * trigger a status 404 event
     */
    notFound: function() {
      App.Events.trigger('status_404');
    }
  });

  /******************
   ***** MODELS *****
   ******************/

  /**
   * Job model
   */
  App.Models.Job = Backbone.Model.extend({
    urlRoot: App.Base + 'jobs'
  });

  /**
   * Jobs collection of Job models. The server response includes a pagination object
   * with the needed pagination data to request more data.
   */
  App.Collections.Jobs = Backbone.Collection.extend({
    model: App.Models.Job,
    url: App.Base + 'jobs',

    // collection pagination data
    pagination: {
      'page' : 0,
      'total': null
    },

    // current search term
    search: '',

    /**
     * extract pagination data, create short description and escape the full description
     *
     * @param object response
     */
    parse: function(response) {
      this.pagination = response.pagination;
      $.each(response.jobs, function(i, j) {
        j.shortDescription = $(markdown.toHTML(parseDescription(j.description))).text().substr(0, 80).trim() + '...';
      })
      return response.jobs;
    }
  });

  /*****************
   ***** VIEWS *****
   *****************/

  /******************************************************
   * Error 404 page not found view
   */
  App.Views.Status404 = Backbone.View.extend({
    el: $('#status404'),

    /**
     * listen to the status_404 event to show the view
     * and the home event to hide it
     */
    initialize: function() {
      App.Events.on('status_404 status_401', this.show, this);
      App.Events.on('home', this.hide, this);
    },

    /**
     * show the view
     */
    show: function() {
      this.$el.show();
    },

    /**
     * hide the view
     */
    hide: function() {
      this.$el.hide();
    }
  });

  /******************************************************
   * Job Listing view  for individual job models listings
   * this view uses a tr tag for the template which then is added 
   * to the tbody's jobs table created by the jobs collection view.
   */
  App.Views.Job = Backbone.View.extend({
    tagName: 'tr',
    template: template('jobTemplate'),
    events: {
      'click .jobTitle': 'viewJob', // click on the job's title
    },

    /**
     * render the job template
     */
    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    },

    /**
     * click event callable to show a job view
     *
     * @param event
     */
    viewJob: function(e) {
      e.preventDefault();
      App.Events.trigger('showJob', this.model);
    }
  });

  /******************************************************
   * Jobs listings view in a table tbody
   * this is the default listings view
   */
  App.Views.Jobs = Backbone.View.extend({
    el: $('#jobsContainer'),
    tagName: 'tbody',

    /**
     * set up click events
     */
    events: {
      'click #addJobButton': 'addJob',
      'click #loadMore': 'loadMore',
      'click #search': 'search'
    },

    /**
     * used to chache jQuery dom elements
     */
    dom: {
    },

    /**
     * initialize view, cache dom elements and set up application event listeners
     */
    initialize: function() {
      this.$el.find('#jobs tbody').remove();
      this.dom.jobs = this.$el.find('#jobs');
      this.dom.empty = this.$el.find('#empty');
      this.dom.loadMore = this.$el.find('#loadMore');
      this.dom.searchForm = this.$el.find('#searchForm');
      
      this.collection = new App.Collections.Jobs();
      this.collection.on('add', this.addOne, this);
      App.Events.on('showListings', this.showListings, this);
      App.Events.on('showJob editJobForm addJob status_404 status_401', this.hideListings, this);
      App.Events.on('home', this.home, this);
    },

    /**
     * display the jobs table or hide it if there are no jobs
     */
    render: function() {
      this.loadMoreButton();
      if(this.collection.length == 0) {
        this.dom.jobs.hide();
        this.dom.empty.show();
      } else {
        this.dom.jobs.show();
        this.dom.empty.hide();
      }
      if(Backbone.history.fragment == '') this.$el.show();
      return this;
    },

    /**
     * go to home page resets the application
     */
    home: function() {
      this.dom.empty.hide();
      this.dom.jobs.hide();
      this.dom.loadMore.addClass('disabled').html('Please wait...').show();
      this.dom.searchForm.val('');
      this.clear();
      this.$el.show();
      this.showListings();
    },

    /**
     * create a new jobView and add it to the jobs table
     *
     * @param model job
     */
    addOne: function(job) {
      var jobView = new App.Views.Job({ model: job });
      this.dom.jobs.append(jobView.render().el);
    },

    /**
     * reset the collection and remove the tbody element with all the jobs
     */
    clear: function() {
      this.collection.reset();
      this.collection.pagination.total = null,
      this.collection.search = '';
      this.collection.page = 0;
      this.$el.find('#jobs tbody').remove();
    },

    /**
     * click on the add job button
     *
     * @param event
     */
    addJob: function(e) {
      e.preventDefault();
      App.Events.trigger('addJob');
    },

    /**
     * search job sets the collection search term and resets the jobs table
     *
     * @param event
     */
    search: function(e) {
      e.preventDefault();
      this.dom.jobs.hide();
      this.dom.empty.hide();
      this.dom.loadMore.addClass('disabled').html('Please wait...').show();
      this.clear();
      this.collection.search = this.dom.searchForm.val();
      this.showListings();
    },

    /**
     * check if the load more button should be displayed depending on the current page
     */
    loadMoreButton: function() {
      if(this.collection.length >= this.collection.pagination.total) {
        this.dom.loadMore.hide();
      } else {
        this.dom.loadMore.show().removeClass('disabled').html('Load more');
      }
    },

    /** 
     * load more jobs
     */
    loadMore: function(e) {
      this.dom.loadMore.addClass('disabled').html('Please wait...');
      this.collection.fetch({
        remove: false,
        data: {
          'page': (parseInt(this.collection.pagination.page) + 1),
          'search': this.collection.search
        },
        success: _.bind(this.loadMoreButton, this),
        error: function(collection, response, options) {
          App.Events.trigger('status_' + response.status);
        }
      });
    },

    /**
     * load listings and render when ready
     */
    showListings: function() {
      router.navigate('');
      this.dom.empty.hide();
      this.dom.jobs.hide();
      this.dom.loadMore.addClass('disabled').html('Please wait...').show();
      this.$el.show();
      if(this.collection.pagination.total === null) { // initialize collection
        this.collection.fetch({
          data: {
            'page' : 0,
            'search' : this.collection.search
          },
          success: _.bind(this.render, this),
          error: function(collection, response, options) {
            App.Events.trigger('status_' + response.status);
          }
        });
      } else {
        this.render();
      }
    },

    /**
     * hide the listings page element
     */
    hideListings: function() {
      this.$el.hide();
    }
  });

  /******************************************************
   * Full job view
   * this view shows the full details for a job offer
   */
  App.Views.JobView = Backbone.View.extend({
    el: $('#job'),
    template: template('jobviewTemplate'),

    /**
     * set up view click events
     */
    events: {
      'click #back': 'back',
      'click #edit': 'edit'
    },

    /**
     * set up application event listeners
     */
    initialize: function() {
      App.Events.on('showJob', this.showJob, this);
      App.Events.on('home showListings status_404 status_401 editJob', this.hide, this);
    },

    /**
     * render the job model and scroll to top
     */
    render: function() {
      if(this.model) {
        var model = this.model.toJSON();
        // parse markdown
        model.description = markdown.toHTML(parseDescription(model.description));
        this.$el.html( this.template(model) );
      }
      this.$el.show();
      $('html body').animate( { scrollTop: 0 });
    },

    /**
     * show a job and set the current route to the job view
     *
     * @param object model
     */
    showJob: function(model) {
      this.model = model
      document.title = App.Name + ' - ' + model.get('title');
      router.navigate('jobs/' + this.model.get('id'));
      this.render();
    },

    /**
     * hide the job view and empty the element
     */
    hide: function() {
      document.title = App.Name;
      this.$el.hide();
      this.$el.empty();
    },

    /**
     * click the back button
     *
     * @param event e
     */
    back: function(e) {
      e.preventDefault();
      this.hide();
      App.Events.trigger('showListings');
    },

    /**
     * show edit email form
     */
     edit: function(e) {
       App.Events.trigger('editJob', this.model);
     }
  });

  /******************************************************
   * Job edit email form view
   */
  App.Views.JobEditEmail = Backbone.View.extend({
    el: $('#jobEditEmail'),

    /**
     * set click and submit events
     */
    events: {
      'submit #editEmailForm' : 'submit',
      'click #cancelEdit' : 'back'
    },

    /**
     * listen for events to show or hide the element
     */
    initialize: function() {
      App.Events.on('editJob', this.show, this);
      App.Events.on('home showListings showJob status_404 status_401', this.hide, this);
    },

    /**
     * reset form and show the element
     */
    show: function(model) {
      this.model = model;
      this.$el.find('#email').val('');
      this.$el.find('#emailEditError').hide();
      this.$el.find('#emailEditSent').hide();
      this.$el.find('#editEmailForm').show();
      this.$el.find('#submitJobEditButton').removeClass('disabled');
      this.$el.show();
      this.$el.find('#email').focus();
    },

    /**
     * hide the element
     */
    hide: function() {
      this.$el.hide();
    },

    /**
     * show the job view when the back button is clicked
     *
     * @param event e
     */
    back: function(e) {
      e.preventDefault();
      this.$el.hide();
      App.Events.trigger('showJob', this.model);
    },

    /**
     * when the form is submited request a new token for the job offer
     *
     * @param event e
     */
    submit: function(e) {
      this.$el.find('#emailEditError').hide();
      this.$el.find('#submitJobEditButton').addClass('disabled');
      e.preventDefault();
      $.post(
        'users/token',
        {
          email: this.$el.find('#email').val(),
          id: this.model.get('id')
        },
        _.bind(function() {
          this.$el.find('#editEmailForm').hide();
          this.$el.find('#emailEditSent').show();
        }, this)
      )
      .fail(_.bind(function() {
        this.$el.find('#emailEditError').show();
      }, this));
    }
  });

  /******************************************************
   * Add a job form view
   */
  App.Views.AddJob = Backbone.View.extend({
    el: '#addJob',
    events: {
      'submit #addJobForm' : 'submit',
      'click #cancel' : 'cancel',
      'click #delete' : 'delete'
    },

    /**
     * used to cache jQuery dom elements
     */
    dom: {},

    /**
     * find form elemenets and bind events
     */
    initialize: function() {
      this.dom.addJobForm = this.$el.find('#addJobForm');
      this.dom.submitJobButton = this.$el.find('#submitJobButton');
      this.dom['text-error'] = this.$el.find('.text-error');

      App.Events.on('addJob', this.showForm, this);
      App.Events.on('editJobForm', this.edit, this);
      App.Events.on('home showListings showJob status_404 status_401', this.hide, this);
    },

    /**
     * show the form view
     *
     * @param event e
     */
    showForm: function(e) {
      router.navigate('jobs/add');
      this.dom.addJobForm.each (function() {
        this.reset();
      });
      this.dom.submitJobButton.val('Submit').removeClass('disabled');
      this.dom['text-error'].html('');
      this.$el.find('#delete').hide();
      this.$el.show();
      this.dom.addJobForm.find('#title').focus();
    },

    /**
     * show jobs form and populate it with the job to be edited
     */
    edit: function(model) {
      this.model = model;
      this.$el.find('#id').val(model.get('id'));
      this.$el.find('#title').val(model.get('title'));
      this.$el.find('#company').val(model.get('company'));
      this.$el.find('#city').val(model.get('city'));
      this.$el.find('#web').val(model.get('web'));
      this.$el.find('#email').val(model.get('email'));
      this.$el.find('#description').val(model.get('description'));
      this.dom.submitJobButton.val('Submit').removeClass('disabled');
      this.$el.find('#delete').show();
      this.dom['text-error'].html('');
      this.$el.show();
    },

    /**
     * delete a job offer
     */
    delete: function(e) {
      e.preventDefault();
      this.model.destroy();
      router.navigate('', true);
      App.Events.trigger('home');
    },

    /**
     * submit the job form and save the new model to the server
     *
     * @param event e
     */
    submit: function(e) {
        e.preventDefault();
        this.dom.submitJobButton.val('Please wait').addClass('disabled');

        var job = new App.Models.Job({
          title: $(e.currentTarget).find('#title').val(),
          company: $(e.currentTarget).find('#company').val(),
          city: $(e.currentTarget).find('#city').val(),
          web: $(e.currentTarget).find('#web').val(),
          email: $(e.currentTarget).find('#email').val(),
          description: $(e.currentTarget).find('#description').val()
        });

        if($(e.currentTarget).find('#id').val() != '') {
          job.id = $(e.currentTarget).find('#id').val();
        }

        job.save(null, {
          success: function(model, response, options) {
            router.navigate('', true);
            App.Events.trigger('home');
          },
          error: _.bind(this.addError, this)
        });
    },

    /**
     * handle error in case the model couldn't be saved to the server
     *
     * @param object model
     * @param xhr
     * @param options
     */
    addError: function(model, xhr, options) {
      if(xhr.status == 202) { // 202 status requires email confirmation
        App.Events.trigger('emailConfirmation');
        this.$el.hide();
      } else { // check for errors in the submitted form
        this.dom.submitJobButton.val('Submit').removeClass('disabled');
        App.Events.trigger('status_' + xhr.status);
        if(xhr.responseJSON) {
          $this = this;
          $.each(xhr.responseJSON, function(index, el) {
            if(el!=='') {
              $this.$el.find('#' + index + 'Error').html(el);
            } else {
              $this.$el.find('#' + index + 'Error').html('');
            }
          });
        }
      }
    },

    /**
     * hide the form view
     */
    hide: function() {
      this.$el.hide();
    },

    /**
     * click the cancel button and go back to the listings page
     *
     * @param event e
     */
    cancel: function(e) {
      e.preventDefault();
      this.hide();
      App.Events.trigger('showListings');
    }
  });

  /******************************************************
   * Email confirmation view
   */
  App.Views.EmailConfirmation = Backbone.View.extend({
    el: '#jobEmailConfirmation',

    /**
     * view events
     */
    events: {
      'click #back' : 'back',
    },

    /**
     * set up the application event listeners
     */
    initialize: function() {
      this.$el.hide();
      App.Events.on('emailConfirmation', this.show, this);
      App.Events.on('home showListings status_404 status_401', this.hide, this);
    },

    /**
     * hide the email notification view
     */
    hide: function() {
      this.$el.hide();
    },

    /**
     * show the email notification view
     */
    show: function() {
      this.$el.show();
    },

    /**
     * click the back button hide the notification view and go to listings page
     *
     * @param event
     */
    back: function(e) {
      e.preventDefault();
      this.hide();
      App.Events.trigger('showListings');
    }
  });

})();