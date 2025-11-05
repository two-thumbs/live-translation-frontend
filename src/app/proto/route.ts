import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { NextRequest } from "next/server";
import protobuf from "protobufjs";

const protoStr = `
syntax = "proto3";

package helloworld;

option java_multiple_files = true;
option java_outer_classname = "HelloWorldProto";
option java_package = "io.grpc.examples.helloworld";

service Greeter {
  rpc SayHello(HelloRequest) returns (HelloReply) {}
}

message HelloRequest {
  bytes audio_data = 1;
  string target_language = 2;
}

message HelloReply {
  string korean = 1;
  string target_text = 2;
}
`;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");

  const packageDefinition = protoLoader.fromJSON(
    protobuf.parse(protoStr, { keepCase: true }).root,
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    }
  );
  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  const greeterPackage = grpcObject.helloworld as any;

  const client = new greeterPackage.Greeter(
    process.env.GRPC_SERVER_URL || "localhost:50052",
    grpc.credentials.createSsl()
  );

  try {
    const buffer = await request.arrayBuffer();
    const audioData = new Uint8Array(buffer);

    const sayHello = (): Promise<{ korean: string; english: string }> =>
      new Promise((resolve, reject) => {
        client.SayHello(
          { audio_data: audioData, target_language: langParam },
          (error: any, response: any) => {
            if (error) {
              console.error(
                `gRPC Error - Code: ${error.code}, Message: ${error.message}`
              );
              reject(error);
            } else {
              console.log("Response:", response);
              resolve(response);
            }
          }
        );
      });

    const response = await sayHello();

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
