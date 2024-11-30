+++
title       = "Getting started"
description = "How to get started with O-MVLL"
weight      = 10
+++

# Getting Started

O-MVLL is a code obfuscator based on LLVM and designed to work with Android and iOS toolchains.
It supports AArch64 and AArch32 as target architectures. Theoretically, it could be run as
simply as using the compiler flag `-fpass-plugin=`, as follows:

```cpp
# Create/edit './omvll_config.py' to configure the obfuscator and run:
$ clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```

**Practically, there are additional configuration steps.**


### O-MVLL Configuration File

Firstly, the O-MVLL Python configuration file is not always located next to the clang binary and we might want
to change the name of the file.

By default, O-MVLL tries to import `omvll_config.py` from **the current directory** in which **clang is called**.
If this file can't be resolved, it raises the following error:

```bash {hl_lines=2}
...
error: ModuleNotFoundError: No module named 'omvll_config'
make: *** [Makefile:31: strings.bin] Error 1
```

To get rid of both limitations: the name of the Python file and the location of the file, one can set the
`OMVLL_CONFIG` environment variable to the full path of your custom configuration file:

```bash {hl_lines=1}
export OMVLL_CONFIG=~/project/obfu/config_test.py
clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```

The O-MVLL configuration file must implements at least one function: `omvll_get_config`

```python
import omvll

def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
```

This function is called by the pass plugin to access the obfuscation scheme defined by the user.
Since the instance of the configuration must be unique, we **highly** recommend wrapping this function with the
`@functools.lru_cache` decorator:

```python {hl_lines=["2", "4"]}
import omvll
from functools import lru_cache

@lru_cache(maxsize=1)
def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
    return MyConfig()
```

This decorator is used to get a *singleton* which simplifies the management of a global variable.


Then, the configuration of the obfuscations relies on implementing a class inheriting from `omvll.ObfuscationConfig`:

```python {hl_lines="4-6"}
import omvll
from functools import lru_cache

class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

@lru_cache(maxsize=1)
def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
    return MyConfig()
```

`MyConfig` is the class that contains all the logic to define and configure the obfuscation scheme.
For instance, we can trigger the [strings encoding pass](<ref /omvll/passes/strings-encoding >)
by implementing the function `obfuscate_string`:

```python {hl_lines="5-14"}
class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

    def obfuscate_string(self, module: omvll.Module, func: omvll.Function,
                               string: bytes):

        if func.demangled_name == "Hello::say_hi()":
            return True

        if "debug.cpp" in module.name:
            return "<REMOVED>"

        return False
```

### Python Standard Library

O-MVLL is statically linked with the Python VM. This static link allows us to **not require**
a specific version of Python installed on the system. On the other hand, the Python VM requires a path
to the directory where the Python Standard Library is installed (e.g. `/usr/lib/python3.10/`).

If the directory of the Python Standard Library can't be resolved, O-MVLL will raise an error like this:

```bash
...
    '/cpython-install/lib/python310.zip',
    '/cpython-install/lib/python3.10',
    '/cpython-install/lib/lib-dynload',
  ]
Fatal Python error: init_fs_encoding: failed to get the Python codec of the filesystem encoding
Python runtime state: core initialized
ModuleNotFoundError: No module named 'encodings'

Current thread 0x00007f612cb48040 (most recent call first):
  <no Python frame>
```

If this error is triggered, we can download the Python source code associated with the version used
in O-MVLL and set the environment variable `OMVLL_PYTHONPATH` to the `Lib/` directory.

Here is an example with Python 3.10:

```bash {hl_lines=4}
curl -LO https://www.python.org/ftp/python/3.10.7/Python-3.10.7.tgz
tar xzvf Python-3.10.7.tgz

export OMVLL_PYTHONPATH=$(pwd)/Python-3.10.7/Lib
clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```


### YAML Configuration File

Setting environment variables is not always easy, especially with IDE like Xcode and Android Studio.

For this reason, O-MVLL is also aware of an `omvll.yml` file that would be present in the directories
from the root `/` to the current working directory.

For instance, if the compiler is called from:

```bash
/home/romain/dev/o-mvll/test/build
```

O-MVLL will check if a file `omvll.yml` is present in the following paths:

```bash
/home/romain/dev/o-mvll/test/build/omvll.yml
/home/romain/dev/o-mvll/test/omvll.yml
/home/romain/dev/o-mvll/omvll.yml
/home/romain/dev/omvll.yml
/home/romain/omvll.yml
/home/omvll.yml
/omvll.yml
```

If this file exists, it will load the following keys:

```yaml
OMVLL_PYTHONPATH: "<mirror of $OMVLL_PYTHONPATH>"
OMVLL_CONFIG:     "<mirror of $OMVLL_CONFIG>"
```

## Android NDK

The toolchain provided by the Android NDK is based on LLVM and **linked with `libc++`**.
To avoid ABI issues, O-MVLL (and its dependencies) are also compiled and linked using `libc++`.

Most of the Linux distributions provide by default the GNU C++ standard library, aka `libstdc++`, and not
the LLVM-based standard library, `libc++`.

Since `libc++.so` is not usually installed on the system, when clang tries to dynamically load `OMVLL.so`,
it fails with the following error:

```bash
$ clang -fpass-plugin=./OMVLL.so main.c -o main
Could not load library './OMVLL.so':
libc++abi.so.1: cannot open shared object file: No such file or directory
```

To prevent this error, we must add the NDK directory that contains `libc++.so` and `libc++abi.so.1`
in the list of the lookup directories. This can be done by setting the environment variable `LD_LIBRARY_PATH`:

```bash
LD_LIBRARY_PATH=<NDK_HOME>/toolchains/llvm/prebuilt/linux-x86_64/lib64
```

`<NDK_HOME>` is the root directory of the NDK. If the NDK is installed along with the Android SDK,
it should be located in `$ANDROID_HOME/ndk/24.0.8215888` for the version `24.0.8215888`.

{{< alert type="dark" icon="fa-regular fa-face-thinking" >}}
The `clang` binary provided in the NDK is also linked with `libc++.so` but we don't need to manually provide the `lib64`
directory as it uses a `RUNPATH` set to `$ORIGIN/../lib64`.
{{</ alert >}}

### Gradle Integration

Within an Android project, we can setup O-MVLL by using the `cppFlags, cFlags` attributes in the
[ExternalNativeCmakeOptions](https://developer.android.com/reference/tools/gradle-api/7.0/com/android/build/api/dsl/ExternalNativeCmakeOptions)
DSL block:

```gradle {hl_lines=[3, 7, 10, 11]}
android {
    compileSdkVersion 30
    ndkVersion        "25.0.8775105"
    ...
    buildTypes {
      release {
        ndk.abiFilters 'arm64-v8a' // Force ARM64
        externalNativeBuild {
          cmake {
            cppFlags '-fpass-plugin=<path>/OMVLL.so'
            cFlags   '-fpass-plugin=<path>/OMVLL.so'
          }
        }
}}}
```

There are important options associated with this configuration:

- `ndkVersion` must match the NDK version for which O-MVLL has been downloaded.
- `ndk.abiFilters` must be `'arm64-v8a'` or `'armeabi-v7a'`, since O-MVLL supports these architectures.

In addition, we might need to satisfy the environment variables mentioned previously
(`LD_LIBRARY_PATH`, `OMVLL_CONFIG`, ...).

To expose these variables, we can create an environment file, `omvll.env`, that defines the variables and
which is *sourced* before running Gradle or Android Studio:

```bash
# File: omvll.env
export NDK_VERSION=25.0.8775105
export LD_LIBRARY_PATH=${ANDROID_HOME}/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/linux-x86_64/lib64
export OMVLL_CONFIG=$(pwd)/app/o-config.py
export OMVLL_PYTHONPATH=$HOME/path/python/Python-3.10.7/Lib
```

```bash
source ./omvll.env
$ ./gradlew assembleRelease
# Or Android Studio:
$ studio.sh
```

In the end, the Android project might follow this layout:

```txt {hl_lines=[4,12]}
.
├── app
│   ├── build.gradle
│   ├── o-config.py
│   └── src
├── build.gradle
├── gradle
│   └── wrapper
├── gradle.properties
├── gradlew
├── local.properties
├── omvll.env
└── settings.gradle
```

Alternatively, you could also create an `omvll.yml` file next to the `omvll.env` but the `LD_LIBRARY_PATH` still
needs to be set.

{{< alert type="warning" icon="fa-regular fa-code-commit" >}}
It can be worth adding `o-config.py`, `omvll.yml`, and `omvll.env` in `.gitignore` to avoid leaks.
{{</ alert >}}

## Android NDK (WSL)


{{< alert type="success" >}}
*Thank you to [Tomáš Soukal](https://sirionrazzer.github.io/blog/) from [Talsec](https://www.talsec.app/)
for this section.*
{{</ alert >}}

### Preparing the WSL for commandline Android development

Based on this article [WSL for Developers!: Installing the Android SDK](https://dev.to/halimsamy/wsl-for-developers-installing-the-android-sdk-53n9)

#### Installing OpenJDK and Gradle

```bash
sudo apt-get update
sudo apt install openjdk-8-jdk-headless gradle
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
```

#### Installing Android Command Line Tools

```bash
cd ~ # Make sure you are at home!
curl https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip -o /tmp/cmd-tools.zip
mkdir -p android/cmdline-tools
unzip -q -d android/cmdline-tools /tmp/cmd-tools.zip
mv android/cmdline-tools/cmdline-tools android/cmdline-tools/latest
rm /tmp/cmd-tools.zip # delete the zip file (optional)
```

#### Setting up environment variables

You could possibly join include these lines in `omvll.env` file:

```bash
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
export ANDROID_HOME=$HOME/android
export ANDROID_SDK_ROOT=${ANDROID_HOME}
export PATH=${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${PATH}
```

#### Accepting SDK licenses

You will find sdkmanager in /tools/bin/sdkmanager:

```bash
yes | sdkmanager --licenses
```

#### Installing SDK components

* pay attention to use ndk version matching the downloaded obfuscator (I used `25.0.8775105 - omvll_ndk_r25.so`)

```bash
./sdkmanager --update
./sdkmanager "platforms;android-31" "build-tools;31.0.0" "ndk;25.0.8775105" "platform-tools"
```

### Obfuscator related changes

#### build.gradle

* adjust path to obfuscator binary ``omvll_ndk_r25.so``, change 'tom' to your username:

```gradle
externalNativeBuild {
    cmake {
        cppFlags "-std=c++14 -frtti -fexceptions
                  -fpass-plugin=/mnt/c/Users/tom/path-to-project/omvll_ndk_r25.so"
    }
}
```

#### omvll.env

```bash
export NDK_VERSION=25.0.8775105
export LD_LIBRARY_PATH=/home/tom/android/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/linux-x86_64/lib64
export OMVLL_CONFIG=/mnt/c/Users/tom/path-to-project/omvll-config.py
export OMVLL_PYTHONPATH=/mnt/c/Users/tom/path-to-project/Python-3.10.7/Lib
```

#### local.properties

I needed to adjust the line with `sdk.dir` in the `local.properties` file:

```ini
...
sdk.dir=/home/tom/android
...
```

#### Troubleshooting

I ran into this issue when running gradlew,

```bash
env: bash\r: No such file or directory
```

The following change helped me:

```bash
vim gradlew
:set fileformat=unix
:wq
```

Finally:

`gradlew clean build`, `gradlew assembleRelease`, or whatever you like :)

## iOS

Using O-MVLL with Xcode is a bit easier than Android since we don't need to deal with different `libstdc++/libc++`.
To enable O-MVLL, one needs to set the following in Xcode:

`Build Settings > Apple Clang - Custom Compiler Flags > Other C/C++ Flags`

and add `-fpass-plugin=<path>/omvll_xcode_15_2.dylib`. For versions targeting Xcode 14.5 and lower, the legacy pass manager
needs to be disabled as well via `-fno-legacy-pass-manager`.

Finally, we can create an `omvll.yml` file next to the `*.xcodeproj` file which defines `OMVLL_PYTHONPATH` and `OMVLL_CONFIG`.

Et voila :)

```yaml
OMVLL_PYTHONPATH: "/Users/romain/Downloads/Python-3.10.8/Lib"
OMVLL_CONFIG:     "/Users/romain/dev/ios-app/demo/omvll_conf/base.py"
```

## Code Completion

The PyPI package [`omvll`](https://pypi.org/project/omvll/1.0.0/) can be used to get code completion
while using O-MVLL:

```bash
$ python -m pip install [--user] omvll
```

![O-MVLL Code Completion](./img/completion.webp "O-MVLL Code Completion")

## Requirements and Limitations

{{< admonition title="Cross Compilation" icon="fa-regular fa-triangle-exclamation" color="danger">}}
O-MVLL is currently tested and CI-compiled for the following configurations:

- **Android NDK**: (Linux Debian Stretch)
- **iOS**: macOS 14.5 (arm64 & x86-64)

<center><strong class="text-danger">
In particular, we did not test and we do not provide O-MVLL for cross-compiling Android projects on OSX and
Windows
</strong></center>

{{</ admonition >}}

## Nightly Packages

There is a CI for O-MVLL. For **all builds**, the packages are *nightly* uploaded at the following addresses:

- Nightly: [{{< get-var "omvll.nightly" >}}]({{< get-var "omvll.nightly" >}})
- Experimental: [{{< get-var "omvll.experimental" >}}]({{< get-var "omvll.experimental" >}})
- CI: [{{< get-var "omvll.github" >}}/actions]({{< get-var "omvll.github" >}}/actions)

Thus, one can enjoy a beta version before waiting for a final release.

## Environment Variables

| Environment Variable | Description                                                            |
|----------------------|------------------------------------------------------------------------|
| `OMVLL_PYTHONPATH`   | Path to the Python Standard Library (which contains `abc.py`)          |
| `OMVLL_CONFIG`       | Path to the O-MVLL Configuration file (default is `./omvll_config.py`) |


## YAML Keys

| Key                  | Description                                                            |
|----------------------|------------------------------------------------------------------------|
| `OMVLL_PYTHONPATH`   | Path to the Python Standard Library (which contains `abc.py`)          |
| `OMVLL_CONFIG`       | Path to the O-MVLL Configuration file (default is `./omvll_config.py`) |


###### Example:

```yaml
OMVLL_PYTHONPATH: "<path>/Python-3.10.8/Lib"
OMVLL_CONFIG:     "<path>/myconfig.py"
```
