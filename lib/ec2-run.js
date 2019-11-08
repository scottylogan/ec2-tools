#! /usr/bin/env node

var aws         = require('aws-sdk'),
    util        = require('util'),
    sprintf     = require('sprintf-js').sprintf,
    chalk       = require('chalk'),
    fs          = require('fs'),
    cmdNode     = process.argv.shift(),
    cmd         = process.argv.shift().replace(/^.+\//, ''),
    arg,
    param,
    params = {
      MinCount:         1,
      MaxCount:         1,
      InstanceType:     't2.micro',
      SecurityGroupIds: [],
      KeyName:          'itlab-aws',
      SubnetId:         undefined,
    },
    titles  = {
      InstanceId:       'Instance',
      InstanceName:     'Name',
      ImageId:          'AMI',
      InstanceType:     'Type',
      PrivateIpAddress: 'Private IP',
      PublicIpAddress:  'Public IP',
    },
    stateColors = {
      'pending':        chalk.bgGreen,
      'running':        chalk.green,
      'shutting-down':  chalk.bgRed,
      'terminated':     chalk.red,
      'stopping':       chalk.bgYellow,
      'stopped':        chalk.yellow,
    },
    instName    = null,
    match       = null;


while (process.argv.length > 0) {
  param = undefined;
  arg = process.argv.shift();
  match = arg.match(/^--([^=]+)(=(.+))?$/);
  if (match) {
    arg = match[1];
    if (match[3]) {
      param = match[3];
    }
    
    switch (arg) {

    case 'region':
      iniOpts.region = param || process.argv.shift();
      break;

    case 'profile':
      iniOpts.credentials = new aws.SharedIniFileCredentials({
        profile: param || process.argv.shift()
      });
      break;

    case 'name':
      instName = param || process.argv.shift();
      break;

    case 'user-data':
      params.UserData =
        fs.readFileSync(param || process.argv.shift())
          .toString('base64');
      break;

    case 'iam-instance-profile':
      // =arn
      params.IamInstanceProfile = { Arn: param || process.argv.shift() };
      break;

    case 'security-group-ids':
      param = param || process.argv.shift();
      params.SecurityGroupIds = param.split(',');
      break;

    default:
      // convert foo-bar-baz to FooBarBaz
      paramName = arg.split('-').map(
        (p) => p[0].toUpperCase() + p.slice(1).toLowerCase()
      ).join('');
      params[paramName] = param || process.argv.shift();
      break;
    }

  } else if (/^ami-[0-9a-fA-F]+$/.test(arg)) {
    // last arg is the image name
    params.ImageId = arg;
  } else {
    console.error('Failed to parse "`${arg}`"');
  }
}

if (!params.ImageId) {
  console.error('An AMI ID is required');
  process.exit(1);
}

aws.config.update(iniOpts);
aws.config.getCredentials(function (err) {
  if (err) {
    console.error(`Failed to get credentials: ${err}`);
    process.exit(1);
  } else {
    var ec2 = new aws.EC2();
    ec2.runInstances(params, function (err, data) {
      var interval = null,
          instances = data ? data.Instances : [],
          states = {};
  
      if (err) {
        console.error(chalk.red(`Failed to create instances: ${err}`));
      } else {

        // tag instances if a name was provided
        if (instName) {
          ec2.createTags({
            Resources: instances.map(function (i) { return i.InstanceId; }),
            Tags: [{
              Key: 'Name',
              Value: instName
            }]
          }, function(err, data) {
            if (err) {
              console.log(err, err.stack);
            }
          });
        }

        interval = setInterval(function () {
          ec2.describeInstances({
            InstanceIds: instances.map(function (i) { return i.InstanceId; })
          }, function (err, data) {
            var instances = [],
                lengths = {},
                format = '',
                fn = null;

            if (err) {
              console.error('ERROR', err);
            } else if ( !data ||
                        !data.Reservations ||
                        data.Reservations.length === 0 ||
                        data.Reservations.every( (r) => r.length === 0))
            {
              console.warn('No reservations');
            } else {
              data.Reservations.forEach(function (res) {
                var states = [];
                res.Instances.forEach (function (inst) {
                  var nameTag = inst.Tags.filter( (tag) => tag.Key && tag.Key === 'Name');

                  inst.InstanceName = (nameTag && nameTag.length && nameTag.length > 0)
                    ? nameTag.pop().Value
                    : '-';

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

                format = [
                  'InstanceId',
                  'InstanceName',
                  'ImageId',
                  'InstanceType',
                  'PrivateIpAddress',
                  'PublicIpAddress',
                ].map( (key) => sprintf('%%(%s)-%ds', key, lengths[key]) ).join(' ');

                console.log(sprintf(format, titles));

                instances.forEach ( (inst) => {
                  var fn = stateColors[inst.State.Name] || chalk.gray;
                  console.log(fn(sprintf(format, inst)));
                  states.push(inst.State.Name);
                });
              
                if (states.every( (s) => s === 'running')) {
                  clearInterval(interval);
                }
              });
            }
          });
        }, 10000);
      }
    });
  }
});

