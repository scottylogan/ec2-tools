#! /usr/bin/env node

var AWS       = require('aws-sdk'),
    fs        = require('fs'),
    procname  = process.argv[1].replace(/^.*\/(\w+).*$/, '$1'),
    sprintf   = require('sprintf-js').sprintf,
    chalk     = require('chalk'),
    cli       = require('cli')
                .enable('version', 'status')
                .setApp(process.mainModule.paths
                        .filter(function (p) {
                          return fs.existsSync(p.replace(/node_modules$/, 'package.json'));
                        })[0]);

// fixup app name
cli.setApp(cli.app + '/' + procname, cli.version);
cli.setUsage(procname + ' [OPTIONS]');

cli.parse({
  'no-headers': [ 'H',        'Do not output headers',                'boolean',  false ],
  json:         [ 'j',        'JSON formatted output',                'boolean',  false ],
  key:          [ 'k',        'JSON object key',                      'string',   undefined ],
  latest:       [ 'l',        'only show latest images',              'boolean',  false ],
  newer:        [ 'n',        'show images newer than N days',        'number',   undefined ],
  older:        [ 'o',        'show images older than N days',        'number',   undefined ],
  owner:        [ 'O',        'show images owned by another account', 'string',   'self' ],
  private:      [ 'P',        'only show private images',             'boolean',  false ],
  profile:      [ undefined,  'AWS profile to use',                   'string',   undefined ],
  public:       [ 'p',        'only show public images',              'boolean',  false ],
  reverse:      [ 'r',        'reverse the output order',             'boolean',  false ],
  state:        [ 's',        'only show images in a specific state', 'string',   undefined ],
  untagged:     [ 'u',        'only show images with no name tag',    'boolean',  false ],
});

var describeImages = function describeImages (images, options) {
  var now       = new Date(),
      olderDt   = (typeof(options.older) === 'number')
                ? new Date(now - (86400000 * Math.floor(options.older)))
                : false,
      newerDt   = (typeof(options.newer) === 'number')
                ? new Date(now - (86400000 * Math.floor(options.newer)))
                : false,
      all       = [],
      ordered   = [],
      latest    = {},
      lengths   = {},
      format    = '',
      sort,
      filter,
      keys      = {
        ImageId:            'id',
        State:              'state',
        Public:             'public',
        Architecture:       'arch',
        RootDeviceType:     'root',
        VirtualizationType: 'virt',
        Hypervisor:         'hyper',
        CreationDate:       'created',
        Description:        'desc',
        TagName:            'tagName',
        Name:               'name',
      },
      titles    = {
        id:         'AMI',
        tagName:    'Name',
        name:       'FullName',
        state:      'State',
        public:     'Public',
        arch:       'Arch',
        root:       'Root',
        virt:       'Virt',
        hyper:      'Hyper',
        created:    'Created',
        desc:       'Description',
      };

  Object.keys(titles).forEach(function (title) {
    lengths[title] = titles[title].length;
  });

  images.forEach(function (image) {
    var img = {
          desc: '-',
          tagName: '-',
          dt: new Date(image.CreationDate),
        };
    
    if (   (olderDt && img.dt > olderDt)
        || (newerDt && img.dt < newerDt)) {
      return;
    }

    image.Tags.forEach(function (tag) {
      if (tag.Key === 'name') {
        image.TagName = tag.Value;
      }
    });

    Object.keys(keys).forEach(function (src) {
      var dst = keys[src];
      if (image.hasOwnProperty(src)) {
        if (src === 'CreationDate') {
          img[dst] = img.dt.toISOString().substr(0,10);
        } else if (typeof image[src] === 'string') {
          img[dst] = image[src];
        } else {
          img[dst] = image[src].toString();
        }
        lengths[dst] = Math.max(img[dst].length, lengths[dst]);
      }
    });

    all.push(img);

    if (img.tagName && options.latest) {
      if (!latest.hasOwnProperty(img.tagName)
          || img.dt > latest[img.tagName].dt) {
        latest[img.tagName] = img;
      }
    }
  });
  
  if (options.latest) {
    sort = function (a,b) {
      var c = a;
      if (options.reverse) {
        a = b; b = c;
      }
      return a.tagName.localeCompare(b.tagName);
    };
    filter = function filter (img) {
      return (img.tagName && img.tagName !== '-' && latest[img.tagName].id === img.id); 
    };
  } else {
    sort = function (a, b) {
      var c = a;
      if (options.reverse) {
        a = b; b = c;
      }
      return a.dt - b.dt;
    };
    filter = function () {
      return true;
    };
  }

  if (options.json) {
    if (options.key) {
      display = function (images) {
        var o = {};
        o[options.key] = images;
        console.log(JSON.stringify(o));
      };
    } else {
      display = function (images) {
        console.log(JSON.stringify(images));
      };
    }
  } else {
    display = function (images) {
      var stateColors = {
            'pending':      chalk.bgGreen,
            'available':    chalk.green,
            'invalid':      chalk.bgyellow,
            'deregistered': chalk.gray,
            'transient':    chalk.yellow,
            'failed':       chalk.bgRed,
            'error':        chalk.red,
          },
          format = [
            'id',
            'tagName',
            'state',
            'public',
            'arch',
            'root',
            'virt',
            'hyper',
            'created',
            'desc',
          ].map(function (key) {
            return sprintf('%%(%s)-%ds', key, lengths[key]);
          }).join(' ');
      
      if (!options['no-headers']) {
        console.log(sprintf(format, titles));
      }

      images.forEach(function (img) {
        var fn = stateColors[img.state] || chalk.gray;
        console.log(fn(sprintf(format, img)));
      });
    };
  }
  
  display(all
    .filter(function (img) {
      return options.untagged ? img.tagName === '-' : true;
    })
    .filter(filter)
    .sort(sort)
  );
};

cli.main(function (args, options) {
  var iniOpts = {},
      params  = {
        Owners:  [ options.owner.toString() ],
        Filters: [
          {
            Name: 'image-type',
            Values: [ 'machine' ],
          }
        ],
      };

  if (options.latest && (options.older || options.newer)) {
    cli.fatal('Cannot mix later, older, and newer options');
  }

  if (options.private && options.public) {
    cli.fatal('Cannot mix private and public options');
  }

  if (options.public || options.private) {
    params.Filters.push({
      Name:   'is-public',
      Values: [ options.public.toString() ],
    });
  }

  if (options.state) {
    params.Filters.push({
      Name:   'state',
      Values: [ options.state ],
    });
  }

  if (options.profile) {
    iniOpts.credentials = new AWS.SharedIniFileCredentials({
      profile: options.profile
    });
  }

  AWS.config.update(iniOpts);
  try {
    AWS.config.getCredentials(function (err) {
      if (err) {
        throw new Error('Failed to get AWS credentials: ' + err);
      } else {
        new AWS.EC2().describeImages(params, function (err, data) {

          if (err) {
            throw new Error(err);
          }
        
          if (!data) {
            throw new Error('No data in response');
          }

          describeImages(data.Images, options);
        });
      }
    });
  } catch (ex) {
    cli.fatal(ex);
  }

});
