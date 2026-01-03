import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { AppConfig } from '../ai-developer-stack';

export interface DatabaseStackProps extends cdk.StackProps {
  config: AppConfig;
}

export class DatabaseStack extends cdk.NestedStack {
  public readonly issuesTable: dynamodb.Table;
  public readonly projectsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Issues table with GSI for queries
    this.issuesTable = new dynamodb.Table(this, 'IssuesTable', {
      tableName: `ai-issue-${config.env}-issues`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.env === 'prod',
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // GSI for assignee queries
    this.issuesTable.addGlobalSecondaryIndex({
      indexName: 'assignee-index',
      partitionKey: { name: 'assigneeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING }
    });

    // GSI for status queries
    this.issuesTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'priority', type: dynamodb.AttributeType.NUMBER }
    });

    // Projects table
    this.projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: `ai-issue-${config.env}-projects`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.env === 'prod',
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // Outputs
    new cdk.CfnOutput(this, 'IssuesTableName', {
      value: this.issuesTable.tableName,
      description: 'Issues DynamoDB table name'
    });
    new cdk.CfnOutput(this, 'ProjectsTableName', {
      value: this.projectsTable.tableName,
      description: 'Projects DynamoDB table name'
    });
  }
}