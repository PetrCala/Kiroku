#!/usr/bin/env ruby
# frozen_string_literal: true

# CI-only, throwaway: give the phone app the SAME bundle identifier on
# iphonesimulator builds that it has on device builds.
#
# The `kiroku` target sets
#   PRODUCT_BUNDLE_IDENTIFIER = org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)
# (which resolves to org.reactjs.native.example.kiroku) and scopes the real id
# to device builds only:
#   "PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]" = org.reactjs.native.example.alcohol-tracker
#
# The embedded watch app's WKCompanionAppBundleIdentifier is the real id, so on
# a simulator the watch app cannot be installed: its companion id matches no
# installed app. Copying each configuration's iphoneos-scoped value to an
# iphonesimulator-scoped one fixes the watch capture job without touching
# device builds.
#
# This edits ONLY the `kiroku` target on purpose. Passing
# PRODUCT_BUNDLE_IDENTIFIER on the xcodebuild command line would override it
# for every target in the workspace, including the generated KirokuUITests
# runner, which must NOT share the app's identifier (the runner installs as its
# own app next to the app under test). And per the Snapfile's hard-won note, do
# NOT reach for `-sdk iphonesimulator` instead; it breaks the watch asset
# catalog build.
#
# Like scripts/setup-screenshots-test-target.rb, the resulting pbxproj diff is
# throwaway and must never be committed.
#
# Usage: bundle exec ruby scripts/set-simulator-bundle-id.rb

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../ios/kiroku.xcodeproj', __dir__)
TARGET_NAME = 'kiroku'
DEVICE_KEY = 'PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]'
SIM_KEY = 'PRODUCT_BUNDLE_IDENTIFIER[sdk=iphonesimulator*]'

def log(msg)
  puts "[set-simulator-bundle-id] #{msg}"
end

project = Xcodeproj::Project.open(PROJECT_PATH)
original_object_version = project.object_version

target = project.targets.find { |t| t.name == TARGET_NAME }
raise "no '#{TARGET_NAME}' target in #{PROJECT_PATH}" unless target

changed = 0
target.build_configurations.each do |config|
  device_id = config.build_settings[DEVICE_KEY]
  next unless device_id
  next if config.build_settings[SIM_KEY] == device_id

  config.build_settings[SIM_KEY] = device_id
  changed += 1
  log "#{config.name}: #{SIM_KEY} = #{device_id}"
end

if project.object_version != original_object_version
  raise 'objectVersion changed; refusing to save (it would break pod install, ' \
        'see scripts/setup-screenshots-test-target.rb)'
end

project.save if changed.positive?
log "#{changed} configuration(s) updated"
