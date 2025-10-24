+++
title       = "Compilation"
description = "How to compile O-MVLL and its dependencies"
weight      = 20
+++

# Compilation

O-MVLL relies on the following dependencies:

1. LLVM (version depending on the toolchain version)
2. CPython ({{< get-var "omvll.dependencies.python.version" >}})
3. spdlog ({{< get-var "omvll.dependencies.spdlog.version" >}})
4. Pybind11 ({{< get-var "omvll.dependencies.pybind11.version" >}})

As a first step, let's consider that we compiled all the dependencies.
O-MVLL is a C++17 **out-of-tree** LLVM pass so we don't need to compile LLVM for each build.

The CMake configuration step can be invoked as follows:

```bash
$ git clone https://github.com/open-obfuscator/o-mvll.git
$ mkdir o-mvll/src/build && cd o-mvll/src/build
```

##### On Linux

```bash
export NDK_STAGE1=${LLVM_ROOT}/out/stage1-install
export NDK_STAGE2=${LLVM_ROOT}/out/stage2

$ cmake -GNinja ..                                              \
        -DCMAKE_BUILD_TYPE=Release                              \
        -DCMAKE_CXX_COMPILER=${NDK_STAGE1}/bin/clang++          \
        -DCMAKE_C_COMPILER=${NDK_STAGE1}/bin/clang              \
        -DCMAKE_CXX_FLAGS="-stdlib=libc++"                      \
        -DPython3_ROOT_DIR=${PYTHON_ROOT}                       \
        -DPython3_LIBRARY=${PYTHON_ROOT}/lib/libpython3.10.a    \
        -DPython3_INCLUDE_DIR=${PYTHON_ROOT}/include/python3.10 \
        -Dpybind11_DIR=${PYBIND11_ROOT}/share/cmake/pybind11    \
        -Dspdlog_DIR=${SPDLOG_ROOT}/lib/cmake/spdlog            \
        -DLLVM_DIR=${NDK_STAGE2}/lib64/cmake/llvm               \
        -DOMVLL_ABI=CustomAndroid
$ ninja
```

##### On macOS

The plugin can be built on macOS for both NDK and Xcode toolchains.
**Prerequisite**: Set the `$LLVM_ROOT` environment variable to point to the LLVM
package corresponding to your target toolchain:

1. NDK: Package ends with `NDK*-Darwin`
2. Xcode: Package ends with `git-{arch}-Darwin`.

###### Xcode

```bash
export XCODE_TOOLCHAIN="$(xcode-select -p)/Toolchains/XcodeDefault.xctoolchain"

$ cmake   -GNinja ..                                              \
          -DCMAKE_BUILD_TYPE=Release                              \
          -DCMAKE_C_COMPILER=${XCODE_TOOLCHAIN}/usr/bin/clang     \
          -DCMAKE_CXX_COMPILER=${XCODE_TOOLCHAIN}/usr/bin/clang++ \
          -DCMAKE_OSX_DEPLOYMENT_TARGET="15.4"                    \
          -DPython3_ROOT_DIR=${PYTHON_ROOT}                       \
          -DPython3_LIBRARY=${PYTHON_ROOT}/lib/libpython3.10.a    \
          -DPython3_INCLUDE_DIR=${PYTHON_ROOT}/include/python3.10 \
          -Dpybind11_DIR=${PYBIND11_ROOT}/share/cmake/pybind11    \
          -Dspdlog_DIR=${SPDLOG_ROOT}/lib/cmake/spdlog            \
          -DLLVM_DIR=${LLVM_ROOT}/lib/cmake/llvm                  \
          -DPYBIND11_NOPYTHON=1                                   \
          -DOMVLL_ABI=Apple
$ ninja
```

###### NDK

{{< alert type="info" >}}
The macOS-compatible NDK toolchain compiler is available through: [`android/ndk/releases`](https://github.com/android/ndk/releases/tag/r26d).
{{</ alert >}}

```bash
export NDK_COMPILER="/path/to/toolchains/llvm/prebuilt/darwin"

$ cmake   -GNinja ..                                              \
          -DCMAKE_BUILD_TYPE=Release                              \
          -DCMAKE_C_COMPILER=${NDK_COMPILER}/bin/clang            \
          -DCMAKE_CXX_COMPILER=${NDK_COMPILER}/bin/clang++        \
          -DCMAKE_OSX_DEPLOYMENT_TARGET="15.4"                    \
          -DPython3_ROOT_DIR=${PYTHON_ROOT}                       \
          -DPython3_LIBRARY=${PYTHON_ROOT}/lib/libpython3.10.a    \
          -DPython3_INCLUDE_DIR=${PYTHON_ROOT}/include/python3.10 \
          -Dpybind11_DIR=${PYBIND11_ROOT}/share/cmake/pybind11    \
          -Dspdlog_DIR=${SPDLOG_ROOT}/lib/cmake/spdlog            \
          -DLLVM_DIR=${LLVM_ROOT}/lib/cmake/llvm                  \
          -DPYBIND11_NOPYTHON=1                                   \
          -DOMVLL_ABI=Android
$ ninja
```

You can download the dependencies at the following links.

### NDK on Linux

{{< alert type="info" >}}
All the dependencies are compiled from the Docker image: [`openobfuscator/omvll-ndk`](https://hub.docker.com/r/openobfuscator/omvll-ndk).
{{</ alert >}}

| Version | URL                                                                                  |
|---------|--------------------------------------------------------------------------------------|
| `r25c`   | [{{< get-var "omvll.prebuilt.ndk.r25c" >}}]({{< get-var "omvll.prebuilt.ndk.r25c" >}}) |
| `r26d`   | [{{< get-var "omvll.prebuilt.ndk.r26d" >}}]({{< get-var "omvll.prebuilt.ndk.r26d" >}}) |

### NDK on macOS

| Version  | URL                                                                                      |
|----------|------------------------------------------------------------------------------------------|
| `r26d`   | [{{< get-var "omvll.prebuilt.ndk-macos.r26d" >}}]({{< get-var "omvll.prebuilt.ndk-macos.r26d" >}}) |

### Xcode

{{< alert type="info" >}}
All the dependencies are compiled with both architectures: `arm64` & `x86-64` from an Apple M1.
{{</ alert >}}

| Version  | URL                                                                                      |
|----------|------------------------------------------------------------------------------------------|
| `14.1` | [{{< get-var "omvll.prebuilt.xcode.v14_1" >}}]({{< get-var "omvll.prebuilt.xcode.v14_1" >}}) |
| `15.2` | [{{< get-var "omvll.prebuilt.xcode.v15_2" >}}]({{< get-var "omvll.prebuilt.xcode.v15_2" >}}) |
| `16.3` | [{{< get-var "omvll.prebuilt.xcode.v16_3" >}}]({{< get-var "omvll.prebuilt.xcode.v16_3" >}}) |

{{< admonition title="Compilation Time" icon="fa-light fa-rabbit-running" color="success">}}
Since O-MVLL is an out-of-tree plugin, **it takes about 2 minutes** to fully compile the obfuscator (using
the pre-compiled dependencies).
{{</ admonition >}}

{{< hicon lvl=2 icon="fa-brands fa-android" >}}Generate NDK deps{{< /hicon >}}

O-MVLL dependencies can be generated easily using the same repository:

```bash
# Make sure you have expected ANDROID_HOME variable is already satisfied
ANDROID_HOME="sdk folder installation"
# Install ndk version used by the project
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --install 'ndk;25.2.9519653'
git clone https://github.com/open-obfuscator/o-mvll.git o-mvll && cd o-mvll
./scripts/deps/generate_deps.sh -p ndk -o output.tar.gz

# output.tar.gz will be generated with all the required dependencies.
```

{{< hicon lvl=2 icon="fa-brands fa-apple" >}}Generate XCode deps{{< /hicon >}}

Manually generating the LLVM deps for Xcode is no longer supported.
Please consider using the prebuilt dependencies instead.

{{< hicon lvl=2 icon="fa-brands fa-docker" >}}Docker Build{{< /hicon >}}

To ease the compilation of O-MVLL, we provide Docker images with the correct environment to
compile O-MVLL for both Android NDK and the Xcode toolchain.

### Android NDK

```bash
$ docker pull openobfuscator/omvll-ndk
$ git clone {{< get-var "omvll.github" >}}

$ curl -LO {{< get-var "omvll.prebuilt.ndk.r26d" >}}
$ mkdir -p ./third-party
$ tar xvf omvll-deps-ndk-r26d.tar -C ./third-party
$ docker run --rm                           \
         -v $(pwd)/o-mvll:/o-mvll           \
         -v $(pwd)/third-party:/third-party \
         openobfuscator/omvll-ndk sh /o-mvll/scripts/docker/ndk_r26d_compile.sh
```

### Xcode

```bash
$ docker pull openobfuscator/omvll-xcode
$ git clone {{< get-var "omvll.github" >}}

$ curl -LO {{< get-var "omvll.prebuilt.xcode.v16_3" >}}
$ mkdir -p ./third-party
$ tar xvf omvll-v1.4.0-macos-deps.tar -C ./third-party
$ docker run --rm                           \
         -v $(pwd)/o-mvll:/o-mvll           \
         -v $(pwd)/third-party:/third-party \
         openobfuscator/omvll-xcode sh /o-mvll/scripts/docker/xcode_16_compile.sh
```
