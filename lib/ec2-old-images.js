#! /usr/bin/env node

const { EC2Client, DescribeImagesCommand } = require('@aws-sdk/client-ec2');
const { fromIni } = require("@aws-sdk/credential-providers")

const days = 90;

const client = new EC2Client();
const command = new DescribeImagesCommand({ Owners: ['self'] });
client.send(command, function (err, data) {
                                          
  var now = Date.now(),
      old = [];

  if (err) {
    console.error(err);
  } else if (!data || !data.Images || data.Images.length === 0) {
    console.error('No image data');
  } else {
    data.Images
      .sort(function (a,b) {
        return (new Date(a.CreationDate)) - (new Date(b.CreationDate));
      })
      .forEach(function (img) {
        var id   = img.ImageId,
            dt   = new Date(img.CreationDate),
            name;

        if ((now - dt) > (days * 86400 * 1000)) {
          img.Tags.forEach(function (tag) {
            if (tag.Key === 'name') {
              name = tag.Value;
            }
          });

          old.push({
            name: name,
            id: id,
            description: img.Description || '',
            dt: dt,
            public: img.Public,
          });
        }
      });

    console.log(JSON.stringify({ images: old }));

  }});
