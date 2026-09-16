Pod::Spec.new do |s|
  s.name           = 'ExpoMorphExport'
  s.version        = '1.0.0'
  s.summary        = 'On-device MyLifelens morph video export'
  s.description    = 'Encodes aligned local photos into an H.264 MP4 without uploading them.'
  s.author         = 'MyLifelens'
  s.homepage       = 'https://mylifelens.app'
  s.source         = { git: 'https://example.invalid/expo-morph-export.git' }
  s.platforms      = { ios: '15.1' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end