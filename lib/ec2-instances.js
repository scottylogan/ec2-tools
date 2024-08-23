#! /usr/bin/env node

const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { fromIni } = require("@aws-sdk/credential-providers")
const util    = require('util'),
      sprintf = require("sprintf-js").sprintf,
      chalk   = require('chalk'),
      cmdNode = process.argv.shift(),
      cmd     = process.argv.shift().replace(/^.+\//, ''),
      titles  = {
        InstanceId:       'Instance',
        InstanceName:     'Name',
        ImageId:          'AMI',
        InstanceType:     'Type',
        PrivateIpAddress: 'Private IP',
        PublicIpAddress:  'Public IP',
        AZ:               'AZ',
      },
      stateColors = {
        'pending':        chalk.bgGreen,
        'running':        chalk.green,
        'shutting-down':  chalk.bgRed,
        'terminated':     chalk.red,
        'stopping':       chalk.bgYellow,
        'stopped':        chalk.yellow,
      };

let arg,
    param,
    params = {},
    credOpts = {};

process.env.AWS_SDK_LOAD_CONFIG=1

if (cmd === 'ec2-running-instances') {
  params = {
    Filters: [ {
      Name: 'instance-state-name',
      Values: [ 'running' ]
    } ]
  };
}

while (process.argv.length > 0) {
  arg   = process.argv.shift().replace(/^--/, '');
  param = process.argv.shift();

  switch (arg) {
    case 'region':
      credOpts.region = param;
      break;
    case 'profile':
      credOpts.profile = param;
      break;
    case 'help':
      console.log('Usage:', cmd, '[--region aws-region] [--profile aws-profile]');
      process.exit(0);
      break;
    default:
      console.warn('Ignoring unsupported option:', arg);
      process.argv.unshift(param);
      break;
  }
}


const client = new EC2Client(credOpts);
const command = new DescribeInstancesCommand(params);

client.send(command, function (err, data) {
  
  var instances = [],
      lengths = {},
      format = '',
      fn = null;

  if (err) {
    console.error(err);
    process.exit(1);
  }

  if ( !data ||
       !data.Reservations ||
       data.Reservations.length === 0 ||
       data.Reservations.every(function (r) {
         return r.length === 0;
       })
     ) {
    console.warn('No reservations');
    process.exit(0);
  }

  data.Reservations.forEach(function (res) {
    res.Instances.forEach(function (inst) {
      var nameTag = inst.Tags.filter( (tag) => tag.Key && tag.Key === 'Name' ),
          billTag = inst.Tags.filter( (tag) => tag.Key && tag.Key === 'itlab:billing' );
              

      inst.InstanceName = (nameTag && nameTag.length && nameTag.length > 0)
        ? nameTag.pop().Value
        : "-";
      inst.AZ = inst.Placement.AvailabilityZone.substr(-1).toUpperCase();
      Object.keys(titles).forEach(function (key) {
        if (!(inst[key])) {
          inst[key] = '-';
        }
        lengths[key] = Math.max(
          inst[key].length,
          lengths[key] ? lengths[key] : titles[key].length
        );
      });
      instances.push(inst);
    });
  });

  format = [
    'InstanceId',
    'InstanceName',
    'ImageId',
    'InstanceType',
    'AZ',
    'PrivateIpAddress',
    'PublicIpAddress',
  ].map(function (key) {
    return sprintf('%%(%s)-%ds', key, lengths[key]);
  }).join(' ');
  console.log(sprintf(format, titles))
  instances.sort(function (a,b) {
    return (a.InstanceName.toLowerCase() === b.InstanceName.toLowerCase())
      ? 0
      : (a.InstanceName.toLowerCase() > b.InstanceName.toLowerCase()) ? 1 : -1;
  }).forEach(function (inst) {
    var fn = stateColors[inst.State.Name] || chalk.gray;
    console.log(fn(sprintf(format, inst)));
  });
});
