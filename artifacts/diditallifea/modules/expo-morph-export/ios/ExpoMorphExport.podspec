Pod::Spec.new do |s|
  s.name           = 'ExpoMorphExport'
  s.version        = '1.0.0'
  s.summary        = 'On-device MyLifelens morph video export'
  s.description    = 'Encodes aligned local photos into an H.264 MP4 without uploading them.'
  s.author         = 'MyLifelens'
  s.homepage       = 'https://mylifelens.app'
  s.source         = { git: 'https://example.invalid/expo-morph-export.git' }
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.9'
  s.module_name    = 'ExpoMorphExport'
  s.static_framework = true
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.resources      = 'ios/Resources/*'
  s.dependency 'ExpoModulesCore'
end