# Scotty's Random Scripts

A set of scripts, mostly for working with AWS EC2.

## EC2 Scripts

### ec2-create-ami [options] instance-id|name

Create an AMI from a running EC2 instance identified either by
instance ID, or by the `Name` tag.

|Option          |Argument|Default|Description|
|----------------|--------|-------|-----------|
|-r/--reboot     |_none_  |false  |Reboot the EC2 instance during AMI creation|
|-n/--name       |string  |(instance Name tag, or ID) + timestamp|AMI name|
|-d/--description|string  |_name_ + " snapshot" |AMI description|
|-w/--wait       |_none_  |       |false  |Wait for AMI creation to finish|
|-p/--profile    |string  |_none_ |AWS Profile to use|

### ec2-images [options]

List EC2 AMIs (images).

|Option          |Argument|Default|Description|
|----------------|--------|-------|-----------|
|-H/--no-headers |_none_  |false  |Don't include headers in output|
|-j/--json       |_none_  |false  |Output JSON rather than plain text|
|-k/--key        |string  |_none_ |Key name for JSON output|
|-l/--latest     |_none_  |false  |Only show latest images|
|-n/--newer      |integer |_none_ |Show images created within the last N days|
|-o/--older      |integer |_none_ |Show images that are at least N days old|
|-O/--owner      |string  |self   |Show images owned by another account|
|-P/--private    |_none_  |false  |Only show private images|
|--profile       |string  |_none_ |AWS Profile to use|
|-p/--public     |_none_  |false  |Only show public images|
|-r/--reverse    |_none_  |false  |Reverse the output order|
|-s/--state      |string  |_none_ |Only show images in a specific state|
|-u/--untagged   |_none_  |false  |Only show images with no Name tag|

### ec2-instances [options]

List EC2 instances.

|Option    |Argument|Default|Description|
|----------|--------|-------|-----------|
|--profile |string  |_none_ |AWS Profile to use|
|--region  |string  |_none_ |AWS Region to query|

If called as `ec2-running-instances` it will only show currently running instances; normall it shows all instances.


### ec2-old-images

Output a JSON representation of images that are more than 90 days old.

## Password and Passphrase Scripts

### passphrase

Generate a four word passphrase.

### pwgen

Generate a password.

|Option |Description|
|-------|-----------|
|-c     |Include capital / upper case letters|
|-n     |Include numbers / digits|
|-y     |Include punctuation|
|-a     |Equivalent to `-c -n -y`|


## Other Scripts

### yubikey

Update SSH Agent to use / not use the PKCS11 provider for Yubikey. Run
`yubikey` after inserting or removing a Yubikey containing an SSH
keypair. It will prompt for PIN / touch as required.
