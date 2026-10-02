Pod::Spec.new do |s|
  s.name = 'SignifyCamera'
  s.version = '1.0.0'
  s.summary = 'On-device camera and ASL fingerspelling inference for Signify'
  s.description = 'Native camera frames, Apple Vision hand detection, and ONNX CNN inference.'
  s.author = 'Signify'
  s.homepage = 'https://github.com/LeeoniIsrael/signify'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/LeeoniIsrael/signify.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'onnxruntime-objc', '1.24.3'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.swift_version = '5.9'
end
