#! /usr/bin/env node

const { EC2Client, CreateImageCommand, DescribeInstancesCommand, CreateTagsCommand } = require('@aws-sdk/client-ec2');
const { fromIni } = require("@aws-sdk/credential-providers")

const procname  = process.argv[1].replace(/^.*\/(\w+).*$/, '$1'),
      sprintf   = require('sprintf-js').sprintf,
      chalk     = require('chalk'),
      cli       = require('cli');

// fixup app name
cli.setApp(cli.app + '/' + procname, cli.version);
cli.setUsage(procname + ' [OPTIONS] {instance-id|name}');

cli.parse({
  reboot:      [ 'r', 'reboot during AMI creation',      'boolean', false ],
  name:        [ 'n', 'AMI name',                        'string',  undefined ],
  description: [ 'd', 'AMI description',                 'string',  undefined ],
  wait:        [ 'w', 'wait for AMI creation to finish', 'boolean', false ],
  profile:     [ undefined, 'AWS profile to use',        'string',  undefined ],
  region:      [ undefined, 'AWS region to use',         'string',  undefined ],
});

var createAMI = function createAMI (client, inst, options) {
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

  const command = new CreateImageCommand({
    InstanceId: inst.InstanceId,
    Name: options.name + (ts ? '-' : '') + ts,
    Description: options.description,
    NoReboot: !options.reboot,
  });
  client.send(command, (err, data) => {
    if (err) {
      throw new Error(err);
    } else if (!data || !data.ImageId) {
      throw new Error('No ImageId in response from AWS');
    } else {
      console.log(data.ImageId);
      const tagCommand = new CreateTagsCommand({
	      Resources: [ data.ImageId ],
	      Tags: [
	        { Key: 'name', Value: options.name },
	        { Key: 'tag',  Value: ts }
	      ]
      });

      client.send(tagCommand, (err, data) => {
	      if (err) {
	        throw new Error(err);
	      }
      });
    }
  });
}

cli.main(function (args, options) {
  let credOpts = {},
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
    credOpts.profile = options.profile
  }
  if (options.region) {
    credOpts.region = options.region
  }

  const client = new EC2Client();
  const command = new DescribeInstancesCommand({
    Filters: [
      {
        Name: filterName,
        Values: args
      }
    ]
  });

  client.send(command, function (err, data) {

	  var instances = [];

    if (err) {
      throw new Error(err);
    }

    if (!data ||
		    !data.Reservations ||
		    data.Reservations.length === 0 ||
		    data.Reservations.every( (r) => r.length === 0 )) {
	    throw new Error('Failed to find a matching instance');
    }

	  data.Reservations.forEach( (res) => {
	    res.Instances.forEach( (inst) => instances.push(inst) );
	  });
	    
	  if (instances.length !== 1) {
	    throw new Error('Found too many matching instances');
	  } else {
	    createAMI(client, instances[0], options);
	  }
  });
});
