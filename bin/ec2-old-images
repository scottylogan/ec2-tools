#! /usr/bin/env node

var AWS = require('aws-sdk'),
    EC2 = new AWS.EC2(),
    days = 90;

var x = EC2.describeImages(
  {
    Owners: ['self']
  },
  function (err, data) {
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
    }
  }
);
