{
  "targets": [
    {
      "target_name": "win32_dll",
      "sources": [
        "src/adapters/sqlite-native/tools/spatialite/win32-dll.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions!": ["-flto=thin", "/flto=thin"]
        },
        "VCLinkerTool": {
          "AdditionalOptions!": ["opt:lldltojobs=2", "-opt:lldltojobs=2", "/opt:lldltojobs=2", "-flto=thin", "/flto=thin"]
        }
      },
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS!="win"', {
          "type": "none"
        }]
      ]
    }
  ]
}
