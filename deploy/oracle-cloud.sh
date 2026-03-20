#!/bin/bash

# Oracle Cloud Free Tier Deploy Script for Ai-GROOT Enterprise
# Este script configura automaticamente o Oracle Cloud Always Free

echo "🚀 Ai-GROOT Enterprise - Oracle Cloud Free Tier Deploy"
echo "=================================================="

# Verificar se está logado no OCI CLI
if ! oci setup bootstrap 2>/dev/null; then
    echo "❌ OCI CLI não configurado. Execute 'oci setup bootstrap' primeiro."
    exit 1
fi

# Configurações
COMPARTMENT_ID=$(oci iam compartment list --query "data[0].id" --raw-output)
REGION=$(oci iam region list --query "data[0].name" --raw-output)
INSTANCE_NAME="ai-groot-enterprise"
SHAPE="VM.Standard.E2.1.Micro"  # Free tier shape

echo "📍 Region: $REGION"
echo "📦 Compartment: $COMPARTMENT_ID"
echo "💻 Instance Shape: $SHAPE"

# Criar VCN (Virtual Cloud Network)
echo "🌐 Criando VCN..."
VCN_ID=$(oci network vcn create \
    --compartment-id $COMPARTMENT_ID \
    --cidr-block 10.0.0.0/16 \
    --display-name ai-groot-vcn \
    --query "data.id" --raw-output)

echo "✅ VCN criada: $VCN_ID"

# Criar Subnet
echo "🔗 Criando Subnet..."
SUBNET_ID=$(oci network subnet create \
    --compartment-id $COMPARTMENT_ID \
    --vcn-id $VCN_ID \
    --cidr-block 10.0.1.0/24 \
    --display-name ai-groot-subnet \
    --query "data.id" --raw-output)

echo "✅ Subnet criada: $SUBNET_ID"

# Criar Internet Gateway
echo "🌍 Criando Internet Gateway..."
IG_ID=$(oci network internet-gateway create \
    --compartment-id $COMPARTMENT_ID \
    --vcn-id $VCN_ID \
    --display-name ai-groot-ig \
    --query "data.id" --raw-output)

echo "✅ Internet Gateway criado: $IG_ID"

# Criar Route Table
echo "🛣️ Criando Route Table..."
RT_ID=$(oci network route-table create \
    --compartment-id $COMPARTMENT_ID \
    --vcn-id $VCN_ID \
    --display-name ai-groot-rt \
    --route-rules "[{\"cidr\":\"0.0.0.0/0\",\"networkEntityId\":\"$IG_ID\"}]" \
    --query "data.id" --raw-output)

echo "✅ Route Table criada: $RT_ID"

# Criar Security List
echo "🔒 Criando Security List..."
SL_ID=$(oci network security-list create \
    --compartment-id $COMPARTMENT_ID \
    --vcn-id $VCN_ID \
    --display-name ai-groot-sl \
    --egress-security-rules "[{\"destination\":\"0.0.0.0/0\",\"protocol\":\"all\",\"isStateless\":false}]" \
    --ingress-security-rules "[{\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"max\":3000,\"min\":3000}},\"isStateless\":false},{\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"tcpOptions\":{\"destinationPortRange\":{\"max\":22,\"min\":22}},\"isStateless\":false}]" \
    --query "data.id" --raw-output)

echo "✅ Security List criado: $SL_ID"

# Criar Compute Instance
echo "🖥️ Criando Compute Instance..."
INSTANCE_ID=$(oci compute instance launch \
    --compartment-id $COMPARTMENT_ID \
    --availability-domain $(oci iam availability-domain list --compartment-id $COMPARTMENT_ID --query "data[0].name" --raw-output) \
    --shape $SHAPE \
    --display-name $INSTANCE_NAME \
    --subnet-id $SUBNET_ID \
    --assign-public-ip true \
    --image-id "ocid1.image.oc1.phx.aaaaaaaaw5x3dga2pqsxirjdcyxsjrp63azdaangfxs4jryq2fa5c6mzpqmmq" \
    --ssh-authorized-keys-file ~/.ssh/id_rsa.pub \
    --metadata '{"user_data":"#!/bin/bash\napt-get update\napt-get install -y docker.io docker-compose\ngroupadd docker\nusermod -aG docker ubuntu\nsystemctl enable docker\nsystemctl start docker\n"}' \
    --query "data.id" --raw-output)

echo "✅ Instance criada: $INSTANCE_ID"

# Esperar instance ficar disponível
echo "⏳ Aguardando instance ficar disponível..."
oci compute instance wait --instance-id $INSTANCE_ID --wait-for-state RUNNING

# Obter IP público
PUBLIC_IP=$(oci compute instance list-vnics --instance-id $INSTANCE_ID --query "data[0].publicIp" --raw-output)

echo "🌐 IP Público: $PUBLIC_IP"

# Instalar Docker e Deploy
echo "🐳 Instalando Docker e fazendo deploy..."
ssh -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
    # Instalar Docker
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose git
    
    # Clonar repositório
    cd /opt
    sudo git clone https://github.com/yourusername/ai-groot.git
    cd ai-groot
    
    # Configurar environment
    sudo cp .env.example .env
    echo "Configure suas API keys em /opt/ai-groot/.env"
    
    # Build e start containers
    sudo docker-compose up -d
    
    # Verificar status
    sudo docker-compose ps
EOF

echo "🎉 Deploy concluído!"
echo "=================="
echo "🌐 URL: http://$PUBLIC_IP:3000"
echo "🔧 Admin: http://$PUBLIC_IP:3000/admin"
echo "📊 Health: http://$PUBLIC_IP:3000/health"
echo ""
echo "📝 Próximos passos:"
echo "1. SSH para a instance: ssh ubuntu@$PUBLIC_IP"
echo "2. Editar /opt/ai-groot/.env com suas API keys"
echo "3. Restart: sudo docker-compose restart"
echo ""
echo "💡 Dica: Configure um domínio personalizado apontando para $PUBLIC_IP"
