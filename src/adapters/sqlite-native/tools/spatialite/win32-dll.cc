#include <napi.h>
#include <windows.h>
#include <string>

Napi::Value AddDllDirectoryPath(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::u16string path_u16 = info[0].As<Napi::String>().Utf16Value();
    LPCWSTR path = reinterpret_cast<LPCWSTR>(path_u16.c_str());

    DLL_DIRECTORY_COOKIE cookie = AddDllDirectory(path);
    if (!cookie) {
        Napi::Error::New(env, "Failed to add DLL directory").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Return the cookie as an external pointer (or a string representing the pointer value, but external is safer for opaque handles)
    return Napi::External<void>::New(env, cookie);
}

Napi::Value RemoveDllDirectoryPath(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsExternal()) {
        Napi::TypeError::New(env, "External cookie expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    DLL_DIRECTORY_COOKIE cookie = info[0].As<Napi::External<void>>().Data();
    BOOL result = RemoveDllDirectory(cookie);

    return Napi::Boolean::New(env, result != 0);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "addDllDirectory"),
                Napi::Function::New(env, AddDllDirectoryPath));
    exports.Set(Napi::String::New(env, "removeDllDirectory"),
                Napi::Function::New(env, RemoveDllDirectoryPath));
    return exports;
}

NODE_API_MODULE(win32_dll, Init)
