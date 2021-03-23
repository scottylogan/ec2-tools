#! /usr/bin/env node

var aws     = require('aws-sdk'),
    util    = require('util'),
    sprintf = require("sprintf-js").sprintf,
    chalk   = require('chalk'),
    cmdNode = process.argv.shift(),
    cmd     = process.argv.shift().replace(/^.+\//, ''),
    arg,
    param,
    params  = {},
    iniOpts = {},
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
      iniOpts.region = param;
      break;
    case 'profile':
      iniOpts.credentials = new aws.SharedIniFileCredentials({profile: param});
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

aws.config.update(iniOpts);
aws.config.getCredentials(function (err) {
  if (err) {
    console.error('Failed to get credentials:', err);
    process.exit(1);
  } else {
    new aws.EC2().describeInstances(
      params,
      function (err, data) {
        var instances = [],
            lengths = {},
            format = '',
            fn = null;

        if (err) {
          console.error('ERROR', err);
        } else if ( !data ||
                    !data.Reservations ||
                    data.Reservations.length === 0 ||
                    data.Reservations.every(function (r) {
                      return r.length === 0;
                    })
        ) {
          console.warn('No reservations');
        } else {
          data.Reservations.forEach(function (res) {
            res.Instances.forEach(function (inst) {
              var nameTag = inst.Tags.filter(function (tag) {
                              return tag.Key && tag.Key === 'Name';
                            }),
                  billTag = inst.Tags.filter(function (tag) {
                              return tag.Key && tag.Key === 'itlab:billing';
                            });
              

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
    //        fn = (inst.InstanceName === 'UNNAMED') ? chalk.yellow : chalk.green;
    //        if (inst.State.Name !== 'running') {
    //          fn = chalk.gray;
    //        }
            console.log(fn(sprintf(format, inst)));
          });
        }
      }
    )
  }
});
