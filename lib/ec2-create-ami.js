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
cli.setUsage(procname + ' [OPTIONS] {instance-id|name}');

cli.parse({
  reboot:      [ 'r', 'reboot during AMI creation',      'boolean', false ],
  name:        [ 'n', 'AMI name',                        'string',  undefined ],
  description: [ 'd', 'AMI description',                 'string',  undefined ],
  wait:        [ 'w', 'wait for AMI creation to finish', 'boolean', false ],
  profile:     [ 'p', 'AWS profile to use',              'string',  undefined ],
});

var createAMI = function createAMI (inst, options) {
  var tagName,
      ts = '';

  if (!options.name) {

    // add a timestamp to image name when it's auto-generated
    ts = '' + Math.floor(Date.now()/1000);

    tagName = inst.Tags.find( (t) => t.Key === 'Name' );
    if (tagName && tagName.Value) {
      options.name = tagName.Value;
    } else {
      options.name = inst.InstanceId;
    }
  }    

  if (!options.description) {
    options.description = options.name + ' snapshot';
  }


  new AWS.EC2().createImage({
    InstanceId: inst.InstanceId,
    Name: options.name + (ts ? '-' : '') + ts,
    Description: options.description,
    NoReboot: !options.reboot,
  }, (err, data) => {
    if (err) {
      throw new Error(err);
    } else if (!data || !data.ImageId) {
      throw new Error('No ImageId in response from AWS');
    } else {
      console.log(data.ImageId);
      new AWS.EC2().createTags({
	Resources: [ data.ImageId ],
	Tags: [
	  { Key: 'name', Value: options.name },
	  { Key: 'tag',  Value: ts }
	]
      }, (err, data) => {
	if (err) {
	  throw new Error(err);
	}
      });
    }
  });
};

cli.main(function (args, options) {
  var iniOpts = {},
      filterName = undefined;

  if (args.length !== 1) {
    cli.fatal('Requires either an instance ID or a Name');
  } else if (/^i-[0-9a-f]+$/.test(args[0])) {
    filterName = 'instance-id';
  } else if (/^[-_.a-zA-Z0-9]+$/) {
    filterName = 'tag:Name';
  } else {
    cli.fatal('Argument is neither an instance ID, nor a Name');
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
	var params = { Filters: [ { Name: filterName, Values: args } ] };

        new AWS.EC2().describeInstances(
	  params,
	  function (err, data) {
	    var instances = [];

            if (err) {
              throw new Error(err);
            }

            if (!data ||
		!data.Reservations ||
		data.Reservations.length === 0 ||
		data.Reservations.every( (r) => r.length === 0 ))
	    {
	      throw new Error('Failed to find a matching instance');
            }

	    data.Reservations.forEach( (res) => {
	      res.Instances.forEach( (inst) => instances.push(inst) );
	    });
	    
	    if (instances.length !== 1) {
	      throw new Error('Found too many matching instances');
	    } else {
	      createAMI(instances[0], options);
	    }
          }
	);
      }
    });
  } catch (ex) {
    cli.fatal(ex);
  }

});
